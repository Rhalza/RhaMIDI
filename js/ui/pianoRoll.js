import { State } from '../core/state.js';
import { DOM } from './dom.js';

export const PianoRoll = {
    gridCanvas: null,
    noteCanvas: null,
    keysCanvas: null,
    ctxGrid: null,
    ctxNotes: null,
    ctxKeys: null,
    
    config: {
        noteHeight: 22,
        beatWidth: 100,
        keysWidth: 70, 
        colors: {
            bg: '#151515',
            lineMain: '#333',
            lineSub: '#222',
            blackKey: '#111',
            whiteKey: '#ccc',
            noteSelectedBorder: '#fff',
            selectionBox: 'rgba(0, 188, 212, 0.2)',
            selectionBorder: 'rgba(0, 188, 212, 0.8)'
        }
    },
    
    selectionRect: null,

    init() {
        this.gridCanvas = DOM.el('grid-canvas');
        this.noteCanvas = DOM.el('notes-canvas');
        this.keysCanvas = DOM.el('keys-canvas');
        
        if (this.gridCanvas) this.ctxGrid = this.gridCanvas.getContext('2d');
        if (this.noteCanvas) this.ctxNotes = this.noteCanvas.getContext('2d');
        if (this.keysCanvas) this.ctxKeys = this.keysCanvas.getContext('2d');
    },

    resize() {
        const view = State.project.view;
        const totalHeight = 128 * this.config.noteHeight * view.zoomY;
        const totalWidth = view.totalBeats * this.config.beatWidth * view.zoomX;

        if (this.keysCanvas) {
            this.keysCanvas.width = this.config.keysWidth;
            this.keysCanvas.height = totalHeight;
            DOM.el('sticky-keys').style.width = `${this.config.keysWidth}px`;
        }

        if (this.gridCanvas) {
            this.gridCanvas.width = totalWidth;
            this.gridCanvas.height = totalHeight;
        }

        if (this.noteCanvas) {
            this.noteCanvas.width = totalWidth;
            this.noteCanvas.height = totalHeight;
        }

        DOM.el('piano-roll-content').style.width = `${totalWidth + this.config.keysWidth}px`;
    },

    render() {
        if (!this.ctxGrid) return;
        
        this.resize();
        this.clear();
        this.drawKeys();
        this.drawGrid();
        this.drawNotes();
        this.drawSelectionBox();
    },

    clear() {
        this.ctxKeys.fillStyle = '#000';
        this.ctxKeys.fillRect(0, 0, this.keysCanvas.width, this.keysCanvas.height);
        
        this.ctxGrid.fillStyle = this.config.colors.bg;
        this.ctxGrid.fillRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        
        this.ctxNotes.clearRect(0, 0, this.noteCanvas.width, this.noteCanvas.height);
    },

    getY(note) {
        const view = State.project.view;
        const nh = this.config.noteHeight * view.zoomY;
        return (127 - note) * nh;
    },

    getX(beat) {
        const view = State.project.view;
        const bw = this.config.beatWidth * view.zoomX;
        return beat * bw;
    },

    drawKeys() {
        const h = this.keysCanvas.height;
        const view = State.project.view;
        const noteH = this.config.noteHeight * view.zoomY;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        this.ctxKeys.font = '11px sans-serif';
        this.ctxKeys.textBaseline = 'middle';
        this.ctxKeys.textAlign = 'right';

        for (let i = 0; i < 128; i++) {
            const y = this.getY(i);
            const noteIdx = i % 12;
            const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);
            
            this.ctxKeys.fillStyle = isBlack ? this.config.colors.blackKey : this.config.colors.whiteKey;
            this.ctxKeys.fillRect(0, y, this.config.keysWidth, noteH);
            
            this.ctxKeys.strokeStyle = '#000';
            this.ctxKeys.strokeRect(0, y, this.config.keysWidth, noteH);

            if (noteIdx === 0 || !isBlack) {
                this.ctxKeys.fillStyle = isBlack ? '#999' : '#555';
                const label = `${notes[noteIdx]}${Math.floor(i/12) - 1}`;
                this.ctxKeys.fillText(label, this.config.keysWidth - 5, y + noteH/2);
            }
        }
    },

    drawGrid() {
        const w = this.gridCanvas.width;
        const h = this.gridCanvas.height;
        const view = State.project.view;
        const noteH = this.config.noteHeight * view.zoomY;
        const beatW = this.config.beatWidth * view.zoomX;

        for (let i = 0; i < 128; i++) {
            const y = this.getY(i);
            const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
            this.ctxGrid.fillStyle = isBlack ? '#1a1a1a' : '#212121';
            this.ctxGrid.fillRect(0, y, w, noteH);
            this.ctxGrid.strokeStyle = this.config.colors.lineSub;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(0, y + noteH);
            this.ctxGrid.lineTo(w, y + noteH);
            this.ctxGrid.stroke();
        }

        for (let i = 0; i < view.totalBeats; i++) {
            const x = this.getX(i);
            this.ctxGrid.strokeStyle = this.config.colors.lineMain;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(x, 0);
            this.ctxGrid.lineTo(x, h);
            this.ctxGrid.stroke();
            
            for (let s = 1; s < 4; s++) {
                const sx = x + (s * (beatW/4));
                this.ctxGrid.strokeStyle = this.config.colors.lineSub;
                this.ctxGrid.beginPath();
                this.ctxGrid.moveTo(sx, 0);
                this.ctxGrid.lineTo(sx, h);
                this.ctxGrid.stroke();
            }
        }
    },

    drawNotes() {
        const track = State.currentTrack;
        if (!track) return;
        const view = State.project.view;
        const noteH = this.config.noteHeight * view.zoomY;
        const beatW = this.config.beatWidth * view.zoomX;

        track.events.forEach(ev => {
            if (ev.type !== 'note') return;
            const x = this.getX(ev.start);
            const y = this.getY(ev.note);
            const w = ev.duration * beatW;

            this.ctxNotes.fillStyle = track.color || '#00bcd4';
            this.ctxNotes.fillRect(x, y+1, w, noteH-2);
            
            this.ctxNotes.strokeStyle = ev.selected ? '#fff' : '#000';
            this.ctxNotes.lineWidth = ev.selected ? 2 : 1;
            this.ctxNotes.strokeRect(x, y+1, w, noteH-2);
            
            this.ctxNotes.fillStyle = 'rgba(255,255,255,0.4)';
            this.ctxNotes.fillRect(x + w - 5, y+2, 5, noteH-4);
        });
    },

    drawSelectionBox() {
        if (!this.selectionRect) return;
        this.ctxNotes.fillStyle = this.config.colors.selectionBox;
        this.ctxNotes.fillRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
        this.ctxNotes.strokeStyle = this.config.colors.selectionBorder;
        this.ctxNotes.strokeRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
    }
};