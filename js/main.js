import { State } from './core/state.js';
import { DOM } from './ui/dom.js';

const init = () => {
    console.log("RhaMIDI Initializing...");

    localforage.config({
        name: 'RhaMIDI',
        storeName: 'soundfonts'
    });

    const track = State.createNewTrack();
    track.selected = true;
    State.project.tracks.push(track);
    
    renderTrackList();

    window.addEventListener('resize', handleResize);
    handleResize();

    setupKeyboardLayout();
};

const renderTrackList = () => {
    const container = DOM.el('track-list-container');
    container.innerHTML = '';

    State.project.tracks.forEach(track => {
        const div = DOM.create('div', 'track-control');
        if (track.selected) div.classList.add('selected');
        
        div.innerHTML = `
            <div style="font-weight:bold; color:${track.color}">${track.name}</div>
            <div style="font-size:0.8rem">Vol: ${Math.round(track.volume * 100)}%</div>
        `;
        
        div.onclick = () => {
            State.project.tracks.forEach(t => t.selected = false);
            track.selected = true;
            renderTrackList();
        };

        container.appendChild(div);
    });
};

const handleResize = () => {
    const canvasContainer = DOM.el('piano-roll-container');
    const gridCanvas = DOM.el('grid-canvas');
    const notesCanvas = DOM.el('notes-canvas');
    
    gridCanvas.width = canvasContainer.clientWidth;
    gridCanvas.height = canvasContainer.clientHeight;
    notesCanvas.width = canvasContainer.clientWidth;
    notesCanvas.height = canvasContainer.clientHeight;
    
};

const setupKeyboardLayout = () => {
    const kb = DOM.el('virtual-keyboard');
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    for(let i=0; i<36; i++) {
        const octave = Math.floor(i / 12) + 2; 
        const noteIdx = i % 12;
        const noteName = notes[noteIdx];
        const isBlack = noteName.includes('#');
        
        const key = DOM.create('div', `piano-key ${isBlack ? 'key-black' : 'key-white'}`);
        key.dataset.note = i + 36; 
        
        if (!isBlack) {
            key.innerHTML = `<span style="position:absolute; bottom:2px; left:2px; font-size:10px; color:#555">${noteName}${octave}</span>`;
        }
        
        kb.appendChild(key);
    }
};

window.addEventListener('DOMContentLoaded', init);