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
        headerHeight: 30,
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

    drawGrid() {
        const w = this.gridCanvas.width;
        const h = this.gridCanvas.height;
        const view = State.project.view;
        
        const scrollX = view.scrollX;
        const scrollY = view.scrollY;
        
        const noteH = this.config.noteHeight * view.zoomY;
        const beatW = this.config.beatWidth * view.zoomX;
        
        this.ctxGrid.lineWidth = 1;

        for (let i = 0; i < 128; i++) {
            const y = h - ((i + 1) * noteH) + scrollY;
            if (y > h || y < -noteH) continue;

            const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
            
            this.ctxGrid.fillStyle = isBlack ? '#1a1a1a' : '#202020';
            this.ctxGrid.fillRect(this.config.keysWidth, y, w, noteH);

            this.ctxGrid.strokeStyle = this.config.colors.lineSub;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(this.config.keysWidth, y);
            this.ctxGrid.lineTo(w, y);
            this.ctxGrid.stroke();
        }

        const totalBeats = 100; 
        for (let i = 0; i < totalBeats * 4; i++) {
            const x = this.config.keysWidth + (i * (beatW / 4)) - scrollX;
            if (x < this.config.keysWidth) continue;
            if (x > w) break;

            this.ctxGrid.strokeStyle = (i % 4 === 0) ? this.config.colors.lineMain : this.config.colors.lineSub;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(x, 0);
            this.ctxGrid.lineTo(x, h);
            this.ctxGrid.stroke();
        }
    },

    drawKeys() {
        const h = this.gridCanvas.height;
        const view = State.project.view;
        const scrollY = view.scrollY;
        const noteH = this.config.noteHeight * view.zoomY;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        this.ctxNotes.font = '10px sans-serif';
        this.ctxNotes.textAlign = 'right';
        this.ctxNotes.textBaseline = 'middle';

        for (let i = 0; i < 128; i++) {
            const y = h - ((i + 1) * noteH) + scrollY;
            if (y > h || y < -noteH) continue;

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

            const x = this.config.keysWidth + (ev.start * beatW) - view.scrollX;
            const y = h - ((ev.note + 1) * noteH) + view.scrollY;
            const w = ev.duration * beatW;

            if (x + w < this.config.keysWidth) return;

            this.ctxNotes.fillStyle = track.color || '#00e5ff';
            this.ctxNotes.fillRect(x, y + 1, w, noteH - 2);

            this.ctxNotes.strokeStyle = '#000';
            this.ctxNotes.lineWidth = 1;
            this.ctxNotes.strokeRect(x, y + 1, w, noteH - 2);
        });
    }
};