import { State } from '../core/state.js';
import { DOM } from './dom.js';
import { PianoRoll } from './pianoRoll.js';
import { AudioEngine } from '../audio/audioEngine.js';

export const Interaction = {
    isDragging: false,
    dragAction: null, // 'move', 'resize', 'create'
    activeNote: null,
    dragStart: { x: 0, y: 0 },
    initialNoteState: null, // { start, note, duration }

    init() {
        const canvas = DOM.el('notes-canvas');
        if (!canvas) return;

        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        DOM.on('notes-canvas', 'contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
    },

    getGridCoordinates(e) {
        const canvas = DOM.el('notes-canvas');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const view = State.project.view;
        const config = PianoRoll.config;
        
        const beatW = config.beatWidth * view.zoomX;
        const noteH = config.noteHeight * view.zoomY;

        // X to Beat
        const rawBeat = (x + view.scrollX - config.keysWidth) / beatW;
        
        // Y to Note (Inverted: 0 at top = 127)
        // y = (127 - note) * nh - scrollY
        // y + scrollY = (127 - note) * nh
        // (y + scrollY) / nh = 127 - note
        // note = 127 - ((y + view.scrollY) / noteH)
        const rawNote = 127 - ((y + view.scrollY) / noteH);
        
        const noteIndex = Math.floor(rawNote);

        return { 
            beat: Math.max(0, rawBeat), 
            note: noteIndex, 
            rawX: x, 
            rawY: y 
        };
    },

    snapBeat(beat) {
        if (!State.project.view.magnetEnabled || State.project.view.snapToGrid === 'off') {
            return beat;
        }
        
        let snapVal = 0.25; // Default 1/16
        const s = State.project.view.snapToGrid;
        if (s === '1/1') snapVal = 4.0;
        if (s === '1/2') snapVal = 2.0;
        if (s === '1/4') snapVal = 1.0;
        if (s === '1/8') snapVal = 0.5;
        if (s === '1/16') snapVal = 0.25;

        return Math.round(beat / snapVal) * snapVal;
    },

    handleMouseDown(e) {
        if (e.button !== 0) return;
        
        const coords = this.getGridCoordinates(e);
        if (coords.note < 0 || coords.note > 127) return;
        if (coords.rawX < PianoRoll.config.keysWidth) return;

        const track = State.currentTrack;
        if (!track) return;

        // Check if hitting an existing note
        const existingNote = track.events.find(ev => 
            ev.type === 'note' && 
            ev.note === coords.note && 
            coords.beat >= ev.start && 
            coords.beat < ev.start + ev.duration
        );

        this.dragStart = { x: e.clientX, y: e.clientY };

        if (existingNote) {
            // Check for Resize (Right Edge)
            const view = State.project.view;
            const beatW = PianoRoll.config.beatWidth * view.zoomX;
            const noteEndPixel = PianoRoll.getX(existingNote.start + existingNote.duration);
            const mousePixel = coords.rawX + PianoRoll.config.keysWidth; // Adjust for internal calc

            // We compare screen X
            const screenX = coords.rawX;
            const noteEndX = PianoRoll.getX(existingNote.start + existingNote.duration) - PianoRoll.config.keysWidth + PianoRoll.config.keysWidth;
            // Actually simpler:
            const noteStartScreen = PianoRoll.getX(existingNote.start);
            const noteWidthScreen = existingNote.duration * beatW;
            const distFromEnd = (noteStartScreen + noteWidthScreen) - (coords.rawX + view.scrollX - view.scrollX); // Cancel out
            // Let's use raw pixels from canvas
            const relativeX = coords.rawX - (noteStartScreen - PianoRoll.config.keysWidth + PianoRoll.config.keysWidth - view.scrollX); // Messy math, simplify:
            
            // X on canvas
            const canvasX = coords.rawX;
            const noteEndCanvasX = PianoRoll.getX(existingNote.start + existingNote.duration);
            
            if (Math.abs(canvasX - noteEndCanvasX) < 10) {
                this.dragAction = 'resize';
                this.activeNote = existingNote;
                this.initialNoteState = { ...existingNote };
            } else {
                this.dragAction = 'move';
                this.activeNote = existingNote;
                this.initialNoteState = { ...existingNote };
            }
        } else {
            // Create Note
            this.dragAction = 'create';
            const start = this.snapBeat(coords.beat);
            
            const newNote = {
                type: 'note',
                note: coords.note,
                velocity: 100,
                start: start,
                duration: State.lastNoteDuration // Use saved duration
            };
            
            track.events.push(newNote);
            this.activeNote = newNote;
            this.initialNoteState = { ...newNote };
            
            AudioEngine.init();
            AudioEngine.resume();
            AudioEngine.synth.playNote(coords.note, AudioEngine.currentTime, 0.1, 100, track.type, track.effectsData);
        }

        this.isDragging = true;
        PianoRoll.render();
    },

    handleMouseMove(e) {
        // Update coordinate display
        const canvas = DOM.el('notes-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                const c = this.getGridCoordinates(e);
                DOM.el('mouse-coords').innerText = `Note: ${c.note} Beat: ${c.beat.toFixed(2)}`;
            }
        }

        if (!this.isDragging || !this.activeNote) return;

        const config = PianoRoll.config;
        const view = State.project.view;
        const beatW = config.beatWidth * view.zoomX;

        const deltaPixels = e.clientX - this.dragStart.x;
        const deltaBeats = deltaPixels / beatW;

        if (this.dragAction === 'resize') {
            let newDur = this.initialNoteState.duration + deltaBeats;
            
            // Snap duration if Magnet is on
            if (view.magnetEnabled && view.snapToGrid !== 'off') {
                const snapVal = this.parseSnap(view.snapToGrid);
                newDur = Math.round(newDur / snapVal) * snapVal;
            }
            
            if (newDur < 0.1) newDur = 0.1;
            this.activeNote.duration = newDur;
            
            // Update Global Note Duration for next note
            State.lastNoteDuration = newDur;

        } else if (this.dragAction === 'move') {
            let newStart = this.initialNoteState.start + deltaBeats;
            newStart = this.snapBeat(newStart);
            if (newStart < 0) newStart = 0;
            this.activeNote.start = newStart;
            
            // Note Y movement
            const deltaY = e.clientY - this.dragStart.y;
            const noteH = config.noteHeight * view.zoomY;
            const deltaNotes = Math.round(deltaY / noteH);
            
            // Inverted Y axis logic: Moving mouse down (positive Y) decreases note index
            let newNote = this.initialNoteState.note - deltaNotes;
            if (newNote > 127) newNote = 127;
            if (newNote < 0) newNote = 0;
            this.activeNote.note = newNote;
        }

        PianoRoll.render();
    },

    handleMouseUp(e) {
        this.isDragging = false;
        this.activeNote = null;
        this.dragAction = null;
    },

    handleRightClick(e) {
        const coords = this.getGridCoordinates(e);
        const track = State.currentTrack;
        if (!track) return;

        const existingIdx = track.events.findIndex(ev => 
            ev.type === 'note' && 
            ev.note === coords.note && 
            coords.beat >= ev.start && 
            coords.beat < ev.start + ev.duration
        );

        if (existingIdx > -1) {
            track.events.splice(existingIdx, 1);
            PianoRoll.render();
        }
    },

    parseSnap(snapStr) {
        if (snapStr === '1/1') return 4.0;
        if (snapStr === '1/2') return 2.0;
        if (snapStr === '1/4') return 1.0;
        if (snapStr === '1/8') return 0.5;
        if (snapStr === '1/16') return 0.25;
        return 0.25;
    }
};