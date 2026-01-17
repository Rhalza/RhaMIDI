import { State } from './state.js';
import { Synthesizer } from '../audio/synth.js';
import { Effects } from '../audio/effects.js';

export const Exporter = {
    async exportProject(type) {
        if (type === 'rhal') {
            this.downloadJSON();
        } else if (type === 'wav') {
            await this.renderAudio('wav');
        } else if (type === 'mp3') {
            await this.renderAudio('mp3');
        }
    },

    downloadJSON() {
        const data = JSON.stringify(State.project);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        this.triggerDownload(url, `${State.project.meta.name}.rhal`);
    },

    async renderAudio(format) {
        const duration = this.calculateProjectDuration();
        const sampleRate = 44100;
        const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

        const masterGain = offlineCtx.createGain();
        masterGain.gain.value = State.project.mixer.masterVolume;
        masterGain.connect(offlineCtx.destination);

        const synth = new Synthesizer(offlineCtx, masterGain);

        State.project.tracks.forEach(track => {
            if (track.muted) return;
            
            track.events.forEach(event => {
                if (event.type === 'note') {
                    const startTime = event.start * (60 / State.project.meta.bpm);
                    const dur = event.duration * (60 / State.project.meta.bpm);
                    synth.playNote(event.note, startTime, dur, event.velocity, track.type);
                }
            });
        });

        const renderedBuffer = await offlineCtx.startRendering();

        if (format === 'wav') {
            const wavBlob = this.bufferToWav(renderedBuffer);
            const url = URL.createObjectURL(wavBlob);
            this.triggerDownload(url, `${State.project.meta.name}.wav`);
        } else if (format === 'mp3') {
            const mp3Blob = this.bufferToMp3(renderedBuffer);
            const url = URL.createObjectURL(mp3Blob);
            this.triggerDownload(url, `${State.project.meta.name}.mp3`);
        }
    },

    calculateProjectDuration() {
        let maxBeat = 0;
        State.project.tracks.forEach(t => {
            t.events.forEach(e => {
                const end = e.start + e.duration;
                if (end > maxBeat) maxBeat = end;
            });
        });
        const seconds = maxBeat * (60 / State.project.meta.bpm);
        return seconds + 2; 
    },

    bufferToWav(buffer) {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferArr = new ArrayBuffer(length);
        const view = new DataView(bufferArr);
        const channels = [];
        let sample = 0;
        let offset = 0;
        let pos = 0;

        setUint32(0x46464952); 
        setUint32(length - 8); 
        setUint32(0x45564157); 
        setUint32(0x20746d66); 
        setUint32(16); 
        setUint16(1); 
        setUint16(numOfChan); 
        setUint32(buffer.sampleRate); 
        setUint32(buffer.sampleRate * 2 * numOfChan); 
        setUint16(numOfChan * 2); 
        setUint16(16); 
        setUint32(0x61746164); 
        setUint32(length - pos - 4); 

        for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

        while (pos < length) {
            for (let i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset])); 
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
                view.setInt16(pos, sample, true); 
                pos += 2;
            }
            offset++; 
        }

        return new Blob([bufferArr], { type: 'audio/wav' });

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    },

    bufferToMp3(buffer) {
        const channels = 1; 
        const sampleRate = buffer.sampleRate;
        const samples = buffer.getChannelData(0); 
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
        const sampleBlockSize = 1152;
        const mp3Data = [];

        const samples16 = new Int16Array(samples.length);
        for(let i=0; i < samples.length; i++) {
            samples16[i] = samples[i] < 0 ? samples[i] * 0x8000 : samples[i] * 0x7FFF;
        }

        let remaining = samples16.length;
        for (let i = 0; remaining >= sampleBlockSize; i += sampleBlockSize) {
            const left = samples16.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(left);
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
            remaining -= sampleBlockSize;
        }
        
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(mp3buf);

        return new Blob(mp3Data, { type: 'audio/mp3' });
    },

    triggerDownload(url, name) {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};