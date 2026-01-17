import { State } from '../core/state.js';
import { DOM } from './dom.js';
import { PianoRoll } from './pianoRoll.js';
import { AudioEngine } from '../audio/audioEngine.js';

export const Interaction = {
    isDragging: false,
    dragAction: null, // 'move', 'resize', 'create', 'select_box'
    activeNote: null,
    dragStart: { x: 0, y: 0, beat: 0, note: 0 },
    initialNoteState: null,
    selectionStart: { x: 0, y: 0 },

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

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                this.deleteSelectedNotes();
            }
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

        const rawBeat = (x + view.scrollX - config.keysWidth) / beatW;
        const rawNote = 127 - ((y + view.scrollY) / noteH);
        
        return { 
            beat: Math.max(0, rawBeat), 
            note: Math.floor(rawNote), 
            rawX: x, 
            rawY: y,
            pixelY: y, // Canvas relative Y
            pixelX: x  // Canvas relative X
        };
    },

    snapBeat(beat) {
        if (!State.project.view.magnetEnabled || State.project.view.snapToGrid === 'off') {
            return beat;
        }
        let snapVal = 0.25; 
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

        this.dragStart = { ...coords };
        this.isDragging = true;

        const existingNote = track.events.find(ev => 
            ev.type === 'note' && 
            ev.note === coords.note && 
            coords.beat >= ev.start && 
            coords.beat < ev.start + ev.duration
        );

        // Shift Click on Empty -> Start Selection Box
        if (!existingNote && e.shiftKey) {
            this.dragAction = 'select_box';
            this.selectionStart = { x: coords.rawX, y: coords.rawY };
            return;
        }

        // Click on Empty -> Create Note
        if (!existingNote) {
            // Deselect others unless shift held? 
            if (!e.shiftKey) {
                track.events.forEach(ev => ev.selected = false);
            }

            this.dragAction = 'create';
            const start = this.snapBeat(coords.beat);
            const newNote = {
                type: 'note',
                note: coords.note,
                velocity: 100,
                start: start,
                duration: State.lastNoteDuration,
                selected: true
            };
            track.events.push(newNote);
            this.activeNote = newNote;
            this.initialNoteState = { ...newNote };
            
            AudioEngine.init();
            AudioEngine.resume();
            AudioEngine.synth.playNote(coords.note, AudioEngine.currentTime, 0.1, 100, track.type, track.effectsData);
            PianoRoll.render();
            return;
        }

        // Click on Note
        if (existingNote) {
            // Check for Resize (Right edge)
            const view = State.project.view;
            const beatW = PianoRoll.config.beatWidth * view.zoomX;
            const noteStartX = PianoRoll.getX(existingNote.start);
            const noteEndX = noteStartX + (existingNote.duration * beatW);
            
            // Note: X coordinates are relative to canvas 0,0
            // Mouse X from getGridCoordinates (rawX) is also canvas relative
            // However, noteEndX accounts for scroll. rawX is strictly mouse pos on canvas.
            
            // Calculate screen space end X of the note
            // noteEndX is based on config.keysWidth offset already
            // We just need to check distance
            if (Math.abs(coords.rawX - noteEndX) < 10) {
                this.dragAction = 'resize';
            } else {
                this.dragAction = 'move';
            }

            // Selection Logic
            if (e.shiftKey) {
                existingNote.selected = !existingNote.selected; // Toggle
            } else {
                if (!existingNote.selected) {
                    track.events.forEach(ev => ev.selected = false);
                    existingNote.selected = true;
                }
            }
            
            this.activeNote = existingNote;
            this.initialNoteState = { ...existingNote };
        }
        
        PianoRoll.render();
    },

    handleMouseMove(e) {
        // Status Bar Update
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

        const deltaPixels = e.clientX - DOM.el('notes-canvas').getBoundingClientRect().left - this.dragStart.rawX;
        const deltaBeats = deltaPixels / beatW;

        if (this.dragAction === 'resize') {
            let newDur = this.initialNoteState.duration + deltaBeats;
            if (view.magnetEnabled && view.snapToGrid !== 'off') {
                const snapVal = this.parseSnap(view.snapToGrid);
                newDur = Math.round(newDur / snapVal) * snapVal;
            }
            if (newDur < 0.1) newDur = 0.1;
            
            // If multiple notes selected, resize all? For now just active.
            this.activeNote.duration = newDur;
            State.lastNoteDuration = newDur;

        } else if (this.dragAction === 'move' || this.dragAction === 'create') {
            // Delta Beat calculation
            let newStart = this.initialNoteState.start + deltaBeats;
            newStart = this.snapBeat(newStart);
            if (newStart < 0) newStart = 0;
            
            // Delta Note calculation
            const deltaY = e.clientY - DOM.el('notes-canvas').getBoundingClientRect().top - this.dragStart.rawY;
            const noteH = config.noteHeight * view.zoomY;
            const deltaNotes = Math.round(deltaY / noteH);
            
            // Invert logic: +Y is down, so lower note index
            let newNote = this.initialNoteState.note - deltaNotes;
            if (newNote > 127) newNote = 127;
            if (newNote < 0) newNote = 0;

            // Apply to Active Note
            this.activeNote.start = newStart;
            this.activeNote.note = newNote;

            // If moving a selected note, move all other selected notes too
            const track = State.currentTrack;
            if (track && this.activeNote.selected) {
                 const beatDiff = newStart - this.initialNoteState.start;
                 const noteDiff = newNote - this.initialNoteState.note;
                 
                 track.events.forEach(ev => {
                     if (ev.selected && ev !== this.activeNote) {
                         // We need a way to track initial state of ALL selected notes.
                         // For simplicity in this step, we only move the active note perfectly
                         // A full multi-move implementation requires storing initial states for all selected.
                         // Let's implement that basic relative move logic:
                         if (!ev.dragStartData) ev.dragStartData = { start: ev.start, note: ev.note };
                         ev.start = Math.max(0, ev.dragStartData.start + beatDiff);
                         ev.note = Math.max(0, Math.min(127, ev.dragStartData.note + noteDiff));
                     }
                 });
            }
        }

        PianoRoll.render();
    },

    handleMouseUp(e) {
        if (this.dragAction === 'select_box' && PianoRoll.selectionRect) {
            // Calculate selection
            const rect = PianoRoll.selectionRect;
            const track = State.currentTrack;
            const view = State.project.view;
            const config = PianoRoll.config;
            const beatW = config.beatWidth * view.zoomX;
            const noteH = config.noteHeight * view.zoomY;

            // Convert Rect back to Beat/Note Ranges
            // Rect X is canvas pixel. 
            const startBeat = (rect.x + view.scrollX - config.keysWidth) / beatW;
            const endBeat = (rect.x + rect.w + view.scrollX - config.keysWidth) / beatW;
            
            // Y logic: Top pixel is higher note. 
            // y = (127 - note) * h - scrollY
            // note = 127 - (y+scrollY)/h
            const topNote = 127 - ((rect.y + view.scrollY) / noteH);
            const bottomNote = 127 - ((rect.y + rect.h + view.scrollY) / noteH);

            track.events.forEach(ev => {
                const noteCenter = ev.note + 0.5; // check overlap better
                const noteStart = ev.start;
                const noteEnd = ev.start + ev.duration;

                // Simple collision: Center of note Y inside rect Y, start/end overlap X
                if (ev.note <= topNote && ev.note >= bottomNote &&
                    noteStart < endBeat && noteEnd > startBeat) {
                    ev.selected = true;
                } else if (!e.shiftKey) {
                    // ev.selected = false; // Only if not holding shift?
                }
            });
            
            PianoRoll.selectionRect = null;
        }

        // Cleanup Multi-move temporary data
        const track = State.currentTrack;
        if (track) {
            track.events.forEach(ev => delete ev.dragStartData);
        }

        this.isDragging = false;
        this.activeNote = null;
        this.dragAction = null;
        PianoRoll.render();
    }
};