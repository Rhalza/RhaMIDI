import { State } from '../core/state.js';
import { DOM } from './dom.js';

export const PianoRoll = {
    gridCanvas: null,
    noteCanvas: null,
    ctxGrid: null,
    ctxNotes: null,
    
    config: {
        noteHeight: 20,
        beatWidth: 80,
        keysWidth: 60,
        colors: {
            bg: '#151515',
            lineMain: '#333',
            lineSub: '#222',
            blackKey: '#222',
            whiteKey: '#ccc',
            noteSelected: '#ffcc00',
            cursor: '#fff'
        }
    },

    init() {
        this.gridCanvas = DOM.el('grid-canvas');
        this.noteCanvas = DOM.el('notes-canvas');
        
        if (this.gridCanvas && this.noteCanvas) {
            this.ctxGrid = this.gridCanvas.getContext('2d');
            this.ctxNotes = this.noteCanvas.getContext('2d');
        }
    },

    render() {
        if (!this.ctxGrid || !this.ctxNotes) return;
        
        this.clear();
        this.drawGrid();
        this.drawKeys();
        this.drawNotes();
    },

    clear() {
        const w = this.gridCanvas.width;
        const h = this.gridCanvas.height;
        this.ctxGrid.clearRect(0, 0, w, h);
        this.ctxNotes.clearRect(0, 0, w, h);
        
        this.ctxGrid.fillStyle = this.config.colors.bg;
        this.ctxGrid.fillRect(0, 0, w, h);
    },

    // Y Position Calculation: 
    // Note 127 is at Top (0). Note 0 is at Bottom.
    // y = (127 - note) * noteHeight - scrollY
    getY(note) {
        const view = State.project.view;
        const nh = this.config.noteHeight * view.zoomY;
        return ((127 - note) * nh) - view.scrollY;
    },

    getX(beat) {
        const view = State.project.view;
        const bw = this.config.beatWidth * view.zoomX;
        return this.config.keysWidth + (beat * bw) - view.scrollX;
    },

    drawGrid() {
        const w = this.gridCanvas.width;
        const h = this.gridCanvas.height;
        const view = State.project.view;
        
        const noteH = this.config.noteHeight * view.zoomY;
        const beatW = this.config.beatWidth * view.zoomX;
        
        // Horizontal Lines (Notes)
        // Optimization: Only draw visible range
        const startNote = Math.floor((view.scrollY) / noteH); // Top visible note index (inverted)
        const visibleNotes = Math.ceil(h / noteH) + 1;
        
        // Note index goes 127 (top) -> 0 (bottom)
        // Loop through visible notes
        for (let i = 0; i < 128; i++) {
            const y = this.getY(i);
            
            if (y > h) continue; // Below view
            if (y + noteH < 0) continue; // Above view

            const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
            
            this.ctxGrid.fillStyle = isBlack ? '#1a1a1a' : '#202020';
            this.ctxGrid.fillRect(this.config.keysWidth, y, w - this.config.keysWidth, noteH);

            this.ctxGrid.strokeStyle = this.config.colors.lineSub;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(this.config.keysWidth, y + noteH);
            this.ctxGrid.lineTo(w, y + noteH);
            this.ctxGrid.stroke();
        }

        // Vertical Lines (Beats)
        const startBeat = Math.floor(view.scrollX / beatW);
        const visibleBeats = Math.ceil(w / beatW) + 2;

        for (let i = startBeat; i < startBeat + visibleBeats; i++) {
            const x = this.getX(i);
            
            this.ctxGrid.strokeStyle = this.config.colors.lineMain;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(x, 0);
            this.ctxGrid.lineTo(x, h);
            this.ctxGrid.stroke();

            // Subdivisions (4 per beat)
            for (let s = 1; s < 4; s++) {
                const sx = x + (s * (beatW / 4));
                this.ctxGrid.strokeStyle = this.config.colors.lineSub;
                this.ctxGrid.beginPath();
                this.ctxGrid.moveTo(sx, 0);
                this.ctxGrid.lineTo(sx, h);
                this.ctxGrid.stroke();
            }
        }
    },

    drawKeys() {
        const h = this.gridCanvas.height;
        const view = State.project.view;
        const noteH = this.config.noteHeight * view.zoomY;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        this.ctxNotes.textAlign = 'right';
        this.ctxNotes.textBaseline = 'middle';
        this.ctxNotes.font = '10px sans-serif';

        for (let i = 0; i < 128; i++) {
            const y = this.getY(i);
            if (y > h || y + noteH < 0) continue;

            const noteIdx = i % 12;
            const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);
            
            this.ctxNotes.fillStyle = isBlack ? this.config.colors.blackKey : this.config.colors.whiteKey;
            this.ctxNotes.fillRect(0, y, this.config.keysWidth, noteH);
            
            this.ctxNotes.strokeStyle = '#555';
            this.ctxNotes.strokeRect(0, y, this.config.keysWidth, noteH);

            if (noteIdx === 0 || !isBlack) {
                this.ctxNotes.fillStyle = isBlack ? '#fff' : '#000';
                this.ctxNotes.fillText(`${notes[noteIdx]}${Math.floor(i/12) - 1}`, this.config.keysWidth - 5, y + noteH/2);
            }
        }
    },

    drawNotes() {
        const track = State.currentTrack;
        if (!track) return;

        const h = this.noteCanvas.height;
        const view = State.project.view;
        const noteH = this.config.noteHeight * view.zoomY;
        const beatW = this.config.beatWidth * view.zoomX;
        
        track.events.forEach(ev => {
            if (ev.type !== 'note') return;

            const x = this.getX(ev.start);
            const y = this.getY(ev.note);
            const w = ev.duration * beatW;

            // Culling
            if (x > this.noteCanvas.width || x + w < this.config.keysWidth) return;
            if (y > h || y + noteH < 0) return;

            // Draw Note Body
            this.ctxNotes.fillStyle = track.color || '#00e5ff';
            this.ctxNotes.fillRect(x, y + 1, w, noteH - 2);

            // Draw Border
            this.ctxNotes.strokeStyle = '#000';
            this.ctxNotes.lineWidth = 1;
            this.ctxNotes.strokeRect(x, y + 1, w, noteH - 2);

            // Draw Resize Handle Area visual hint
            this.ctxNotes.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctxNotes.fillRect(x + w - 5, y + 1, 5, noteH - 2);
        });
    }
};