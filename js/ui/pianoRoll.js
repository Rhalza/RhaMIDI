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
            blackKey: '#181818',
            whiteKey: '#ccc',
            noteSelectedBorder: '#ffffff',
            selectionBox: 'rgba(0, 229, 255, 0.2)',
            selectionBorder: 'rgba(0, 229, 255, 0.6)'
        }
    },

    selectionRect: null, // {x, y, w, h} in pixels relative to canvas

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
        this.drawSelectionBox();
    },

    clear() {
        const w = this.gridCanvas.width;
        const h = this.gridCanvas.height;
        this.ctxGrid.clearRect(0, 0, w, h);
        this.ctxNotes.clearRect(0, 0, w, h);
        
        this.ctxGrid.fillStyle = this.config.colors.bg;
        this.ctxGrid.fillRect(0, 0, w, h);
    },

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
        
        for (let i = 0; i < 128; i++) {
            const y = this.getY(i);
            if (y > h) continue;
            if (y + noteH < 0) continue;

            const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
            this.ctxGrid.fillStyle = isBlack ? '#1a1a1a' : '#212121';
            this.ctxGrid.fillRect(this.config.keysWidth, y, w - this.config.keysWidth, noteH);

            this.ctxGrid.strokeStyle = this.config.colors.lineSub;
            this.ctxGrid.lineWidth = 1;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(this.config.keysWidth, y + noteH);
            this.ctxGrid.lineTo(w, y + noteH);
            this.ctxGrid.stroke();
        }

        const startBeat = Math.floor(view.scrollX / beatW);
        const visibleBeats = Math.ceil(w / beatW) + 1;

        for (let i = startBeat; i < startBeat + visibleBeats; i++) {
            const x = this.getX(i);
            
            this.ctxGrid.strokeStyle = this.config.colors.lineMain;
            this.ctxGrid.beginPath();
            this.ctxGrid.moveTo(x, 0);
            this.ctxGrid.lineTo(x, h);
            this.ctxGrid.stroke();

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
            
            this.ctxNotes.strokeStyle = '#000';
            this.ctxNotes.strokeRect(0, y, this.config.keysWidth, noteH);

            if (noteIdx === 0 || !isBlack) {
                this.ctxNotes.fillStyle = isBlack ? '#999' : '#333';
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

            if (x > this.noteCanvas.width || x + w < this.config.keysWidth) return;
            if (y > h || y + noteH < 0) return;

            this.ctxNotes.fillStyle = track.color || '#00e5ff';
            this.ctxNotes.fillRect(x, y + 1, w, noteH - 2);

            this.ctxNotes.strokeStyle = ev.selected ? this.config.colors.noteSelectedBorder : '#000';
            this.ctxNotes.lineWidth = ev.selected ? 2 : 1;
            this.ctxNotes.strokeRect(x, y + 1, w, noteH - 2);

            // Resize handle visual
            this.ctxNotes.fillStyle = 'rgba(255,255,255,0.4)';
            this.ctxNotes.fillRect(x + w - 6, y + 2, 4, noteH - 4);
        });
    },

    drawSelectionBox() {
        if (!this.selectionRect) return;
        this.ctxNotes.fillStyle = this.config.colors.selectionBox;
        this.ctxNotes.fillRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
        
        this.ctxNotes.strokeStyle = this.config.colors.selectionBorder;
        this.ctxNotes.lineWidth = 1;
        this.ctxNotes.strokeRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
    }
};