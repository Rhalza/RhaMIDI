import { State } from './state.js';

export const Importer = {
    handleFileSelect(evt) {
        const files = evt.target.files; 
        if (!files.length) return;

        const file = files[0];
        const reader = new FileReader();

        const ext = file.name.split('.').pop().toLowerCase();

        reader.onload = (e) => {
            if (ext === 'rhal') {
                this.parseRhal(e.target.result);
            } else if (ext === 'mid' || ext === 'midi') {
                this.parseMidi(e.target.result);
            } else if (ext === 'sf2') {
                this.storeSoundFont(file.name, e.target.result);
            }
        };

        if (ext === 'rhal') {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    },

    parseRhal(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            State.loadProject(data);
        } catch (err) {
            console.error(err);
            alert("Invalid .rhal file");
        }
    },

    async storeSoundFont(name, arrayBuffer) {
        try {
            await localforage.setItem(name, arrayBuffer);
            alert(`SoundFont ${name} loaded into storage.`);
        } catch (e) {
            console.error(e);
        }
    },

    parseMidi(arrayBuffer) {
        const data = new Uint8Array(arrayBuffer);
        let p = 0;

        const readStr = (len) => {
            let s = "";
            for (let i = 0; i < len; i++) s += String.fromCharCode(data[p++]);
            return s;
        };

        const read32 = () => {
            return (data[p++] << 24) | (data[p++] << 16) | (data[p++] << 8) | data[p++];
        };

        const read16 = () => {
            return (data[p++] << 8) | data[p++];
        };

        const readVarInt = () => {
            let result = 0;
            let b;
            do {
                b = data[p++];
                result = (result << 7) | (b & 0x7F);
            } while (b & 0x80);
            return result;
        };

        if (readStr(4) !== 'MThd') throw new Error("Not a MIDI file");
        read32(); 
        const format = read16();
        const numTracks = read16();
        const timeDiv = read16();

        const newTracks = [];

        for (let t = 0; t < numTracks; t++) {
            if (readStr(4) !== 'MTrk') break;
            const trackLen = read32();
            const endP = p + trackLen;

            let ticks = 0;
            let status = 0;
            
            const trackEvents = [];

            while (p < endP) {
                ticks += readVarInt();
                let b = data[p];

                if (b & 0x80) {
                    status = data[p++];
                }

                const type = status >> 4;
                
                if (type === 0x9 || type === 0x8) {
                    const note = data[p++] & 0x7F;
                    const vel = data[p++] & 0x7F;
                    
                    trackEvents.push({
                        ticks: ticks,
                        type: (type === 0x9 && vel > 0) ? 'noteOn' : 'noteOff',
                        note: note,
                        velocity: vel
                    });
                } else if (type === 0xC || type === 0xD) {
                    p++; 
                } else if (type === 0xB || type === 0xE || type === 0xA) {
                    p += 2;
                } else if (status === 0xFF) {
                    const metaType = data[p++];
                    const len = readVarInt();
                    p += len; 
                } else if (status === 0xF0 || status === 0xF7) {
                    const len = readVarInt();
                    p += len;
                }
            }

            const processedEvents = [];
            const openNotes = {};

            trackEvents.forEach(e => {
                if (e.type === 'noteOn') {
                    openNotes[e.note] = { start: e.ticks, vel: e.velocity };
                } else if (e.type === 'noteOff') {
                    if (openNotes[e.note]) {
                        const on = openNotes[e.note];
                        processedEvents.push({
                            type: 'note',
                            note: e.note,
                            velocity: on.vel,
                            start: on.start / timeDiv, 
                            duration: (e.ticks - on.start) / timeDiv
                        });
                        delete openNotes[e.note];
                    }
                }
            });

            if (processedEvents.length > 0) {
                const track = State.createNewTrack();
                track.name = `Imported MIDI ${t+1}`;
                track.events = processedEvents;
                newTracks.push(track);
            }
        }

        if (newTracks.length > 0) {
            State.project.tracks = newTracks;
            State.project.tracks[0].selected = true;
            State.emit('projectLoaded');
        }
    }
};