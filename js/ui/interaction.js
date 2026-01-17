import { State } from '../core/state.js';
import { DOM } from './dom.js';
import { PianoRoll } from './pianoRoll.js';
import { AudioEngine } from '../audio/audioEngine.js';

export const Interaction = {
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    currentTool: 'pointer', 

    init() {
        const canvas = DOM.el('notes-canvas');
        if (!canvas) return;

        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
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

        const scrollX = view.scrollX;
        const scrollY = view.scrollY;

        const gridX = x + scrollX - config.keysWidth;
        const gridY = y - scrollY;

        let beatIndex = gridX / beatW;
        let noteIndex = 127 - Math.floor(gridY / noteH);

        if (beatIndex < 0) beatIndex = 0;
        
        const snap = this.parseSnap(view.snapToGrid);
        beatIndex = Math.floor(beatIndex / snap) * snap;

        return { beat: beatIndex, note: noteIndex, rawX: x, rawY: y };
    },

    parseSnap(snapStr) {
        if (snapStr === '1/4') return 1;
        if (snapStr === '1/8') return 0.5;
        if (snapStr === '1/16') return 0.25;
        return 0.25;
    },

    handleMouseDown(e) {
        if (e.button !== 0) return; 
        
        const coords = this.getGridCoordinates(e);
        if (coords.note < 0 || coords.note > 127) return;

        const track = State.currentTrack;
        if (!track) return;

        const existingNote = track.events.find(ev => 
            ev.type === 'note' && 
            ev.note === coords.note && 
            coords.beat >= ev.start && 
            coords.beat < ev.start + ev.duration
        );

        if (existingNote) {
            this.handleNoteClick(existingNote);
        } else {
            this.addNote(coords.beat, coords.note);
        }
        
        PianoRoll.render();
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

    addNote(start, note) {
        const track = State.currentTrack;
        if (!track) return;

        const newNote = {
            type: 'note',
            note: note,
            velocity: 100,
            start: start,
            duration: this.parseSnap(State.project.view.snapToGrid)
        };

        track.events.push(newNote);
        
        AudioEngine.init();
        AudioEngine.resume();
        AudioEngine.synth.playNote(note, AudioEngine.currentTime, 0.1, 100, track.type);
    },

    handleNoteClick(noteEvent) {
        
    },

    handleMouseMove(e) {
        
    },

    handleMouseUp(e) {
        this.isDragging = false;
    }
};