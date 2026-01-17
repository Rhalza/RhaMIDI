import { State } from '../core/state.js';
import { DOM } from './dom.js';
import { PianoRoll } from './pianoRoll.js';
import { AudioEngine } from '../audio/audioEngine.js';
import { Sequencer } from '../core/sequencer.js';

export const Interaction = {
    isDragging: false,
    dragAction: null,
    activeNote: null,
    dragStart: { x: 0, y: 0, beat: 0, note: 0 },
    initialNoteState: null,
    selectionStart: { x: 0, y: 0 },

    init() {
        const canvas = DOM.el('notes-canvas');
        const ruler = DOM.el('ruler-scroll-area');
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            DOM.on('notes-canvas', 'contextmenu', (e) => { e.preventDefault(); this.handleRightClick(e); });
        }
        if (ruler) {
            ruler.addEventListener('mousedown', (e) => this.handleRulerClick(e));
        }

        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') this.deleteSelectedNotes();
        });
    },

    deleteSelectedNotes() {
        const track = State.currentTrack;
        if (!track) return;
        track.events = track.events.filter(ev => !ev.selected);
        PianoRoll.render();
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

        const rawBeat = x / beatW; 
        const rawNote = 127 - (y / noteH);
        
        return { 
            beat: Math.max(0, rawBeat), 
            note: Math.floor(rawNote), 
            rawX: x, 
            rawY: y
        };
    },

    parseSnap(snapStr) {
        if (snapStr === '1/1') return 4.0;
        if (snapStr === '1/2') return 2.0;
        if (snapStr === '1/4') return 1.0;
        if (snapStr === '1/8') return 0.5;
        if (snapStr === '1/16') return 0.25;
        return 0.25;
    },

    snapBeat(beat) {
        const s = State.project.view.snapToGrid;
        const val = this.parseSnap(s);
        return Math.round(beat / val) * val;
    },

    handleRulerClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const view = State.project.view;
        const beatW = PianoRoll.config.beatWidth * view.zoomX;
        const beat = x / beatW;
        Sequencer.setTime(beat);
        PianoRoll.render(); 
        const ph = DOM.el('playhead');
        if(ph) ph.style.left = `${x}px`;
    },

    checkDynamicResize(endBeat) {
        let changed = false;
        while (endBeat > State.project.view.totalBeats - 4) {
            State.project.view.totalBeats += 4;
            changed = true;
        }
        if (changed) PianoRoll.render();
    },

    handleMouseDown(e) {
        if (e.button !== 0) return; 
        const coords = this.getGridCoordinates(e);
        if (coords.note < 0 || coords.note > 127) return;

        const track = State.currentTrack;
        if (!track) return;

        this.dragStart = { ...coords };
        this.isDragging = true;

        if (State.tool === 'select') {
            this.dragAction = 'select_box';
            this.selectionStart = { x: coords.rawX, y: coords.rawY };
            return;
        }

        const existingNote = track.events.find(ev => 
            ev.type === 'note' && 
            ev.note === coords.note && 
            coords.beat >= ev.start && 
            coords.beat < ev.start + ev.duration
        );

        if (State.tool === 'delete') {
            if (existingNote) {
                track.events = track.events.filter(n => n !== existingNote);
                PianoRoll.render();
            }
            return;
        }

        if (existingNote) {
            const view = State.project.view;
            const noteEndX = PianoRoll.getX(existingNote.start + existingNote.duration);
            
            if (Math.abs(coords.rawX - noteEndX) < 15) { 
                this.dragAction = 'resize';
            } else {
                this.dragAction = 'move';
            }
            
            if (!e.shiftKey && !existingNote.selected) {
                track.events.forEach(ev => ev.selected = false);
            }
            existingNote.selected = true;
            this.activeNote = existingNote;
            this.initialNoteState = { ...existingNote };
        } else {
            if (!e.shiftKey) track.events.forEach(ev => ev.selected = false);
            this.dragAction = 'create';
            const start = this.snapBeat(coords.beat);
            const newNote = {
                type: 'note', note: coords.note, velocity: 100,
                start: start, duration: State.lastNoteDuration, selected: true
            };
            track.events.push(newNote);
            this.activeNote = newNote;
            this.initialNoteState = { ...newNote };
            AudioEngine.init();
            AudioEngine.resume();
            AudioEngine.synth.playNote(coords.note, AudioEngine.currentTime, 0.1, 100, track.type, track.effectsData);
            
            this.checkDynamicResize(start + newNote.duration);
        }
        PianoRoll.render();
    },

    handleMouseMove(e) {
        const canvas = DOM.el('notes-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                const c = this.getGridCoordinates(e);
                DOM.el('mouse-coords').innerText = `Note: ${c.note} | Beat: ${c.beat.toFixed(2)}`;
            }
        }

        if (!this.isDragging) return;

        const coords = this.getGridCoordinates(e);
        const config = PianoRoll.config;
        const view = State.project.view;
        const beatW = config.beatWidth * view.zoomX;

        if (this.dragAction === 'select_box') {
            const x = Math.min(this.selectionStart.x, coords.rawX);
            const y = Math.min(this.selectionStart.y, coords.rawY);
            const w = Math.abs(coords.rawX - this.selectionStart.x);
            const h = Math.abs(coords.rawY - this.selectionStart.y);
            PianoRoll.selectionRect = { x, y, w, h };
            PianoRoll.render();
            return;
        }

        if (!this.activeNote) return;

        const deltaPixels = coords.rawX - this.dragStart.rawX;
        const deltaBeats = deltaPixels / beatW;

        if (this.dragAction === 'resize') {
            let newDur = this.initialNoteState.duration + deltaBeats;
            
            const snapVal = this.parseSnap(view.snapToGrid);
            newDur = Math.round(newDur / snapVal) * snapVal;
            
            if (newDur < snapVal) newDur = snapVal; 
            
            this.activeNote.duration = newDur;
            State.lastNoteDuration = newDur;
            this.checkDynamicResize(this.activeNote.start + newDur);
        } else if (this.dragAction === 'move' || this.dragAction === 'create') {
            let newStart = this.initialNoteState.start + deltaBeats;
            newStart = this.snapBeat(newStart);
            if (newStart < 0) newStart = 0;
            
            const deltaY = coords.rawY - this.dragStart.rawY;
            const noteH = config.noteHeight * view.zoomY;
            const deltaNotes = Math.round(deltaY / noteH);
            let newNote = this.initialNoteState.note - deltaNotes;
            if (newNote > 127) newNote = 127;
            if (newNote < 0) newNote = 0;

            this.activeNote.start = newStart;
            this.activeNote.note = newNote;
            
            const track = State.currentTrack;
            if (track && this.activeNote.selected) {
                 const beatDiff = newStart - this.initialNoteState.start;
                 const noteDiff = newNote - this.initialNoteState.note;
                 track.events.forEach(ev => {
                     if (ev.selected && ev !== this.activeNote) {
                         if (!ev.dragStartData) ev.dragStartData = { start: ev.start, note: ev.note };
                         ev.start = Math.max(0, ev.dragStartData.start + beatDiff);
                         ev.note = Math.max(0, Math.min(127, ev.dragStartData.note + noteDiff));
                     }
                 });
            }
            this.checkDynamicResize(newStart + this.activeNote.duration);
        }
        PianoRoll.render();
    },

    handleMouseUp(e) {
        if (this.dragAction === 'select_box' && PianoRoll.selectionRect) {
            const rect = PianoRoll.selectionRect;
            const track = State.currentTrack;
            const view = State.project.view;
            const config = PianoRoll.config;
            const beatW = config.beatWidth * view.zoomX;
            const noteH = config.noteHeight * view.zoomY;

            const startBeat = rect.x / beatW;
            const endBeat = (rect.x + rect.w) / beatW;
            const topNote = 127 - (rect.y / noteH);
            const bottomNote = 127 - ((rect.y + rect.h) / noteH);

            track.events.forEach(ev => {
                const nStart = ev.start;
                const nEnd = ev.start + ev.duration;
                // A note is selected if its center Y is within rect Y, and ranges overlap in X
                if (ev.note <= topNote && ev.note >= bottomNote && nStart < endBeat && nEnd > startBeat) {
                    ev.selected = true;
                } else if (!e.shiftKey) {
                    ev.selected = false;
                }
            });
            PianoRoll.selectionRect = null;
        }

        const track = State.currentTrack;
        if (track) track.events.forEach(ev => delete ev.dragStartData);

        this.isDragging = false;
        this.activeNote = null;
        this.dragAction = null;
        PianoRoll.render();
    },

    handleRightClick(e) {
        const coords = this.getGridCoordinates(e);
        const track = State.currentTrack;
        if (!track) return;
        const existingIdx = track.events.findIndex(ev => 
            ev.type === 'note' && ev.note === coords.note && coords.beat >= ev.start && coords.beat < ev.start + ev.duration
        );
        if (existingIdx > -1) {
            track.events.splice(existingIdx, 1);
            PianoRoll.render();
        }
    }
};