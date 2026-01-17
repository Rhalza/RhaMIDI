import { State } from './core/state.js';
import { DOM } from './ui/dom.js';
import { Sequencer } from './core/sequencer.js';
import { AudioEngine } from './audio/audioEngine.js';
import { PianoRoll } from './ui/pianoRoll.js';
import { Importer } from './core/importer.js';

const init = () => {
    localforage.config({ name: 'RhaMIDI', storeName: 'soundfonts' });

    Sequencer.init();
    PianoRoll.init();

    if (State.project.tracks.length === 0) {
        const track = State.createNewTrack();
        track.selected = true;
        State.project.tracks.push(track);
    }
    
    renderTrackList();
    setupEventListeners();
    handleResize();
    setupKeyboardLayout();
    
    State.on('projectLoaded', () => {
        renderTrackList();
        PianoRoll.render();
    });

    requestAnimationFrame(uiLoop);
};

const setupEventListeners = () => {
    window.addEventListener('resize', handleResize);
    
    DOM.on('btn-play', 'click', () => {
        if(Sequencer.isPlaying) {
            Sequencer.stop();
            togglePlayButton(false);
        } else {
            Sequencer.play();
            togglePlayButton(true);
        }
    });

    DOM.on('btn-stop', 'click', () => {
        Sequencer.stop();
        togglePlayButton(false);
        const timeDisplay = DOM.el('time-display');
        if(timeDisplay) timeDisplay.innerText = "00:00:00";
    });

    DOM.on('bpm-input', 'change', (e) => Sequencer.setBpm(parseInt(e.target.value)));

    DOM.on('btn-project', 'click', () => {
        const input = DOM.el('file-import-input');
        input.click();
    });
    
    DOM.on('file-import-input', 'change', (e) => Importer.handleFileSelect(e));

    const kb = DOM.el('virtual-keyboard');
    kb.addEventListener('mousedown', (e) => {
        if(e.target.classList.contains('piano-key') || e.target.parentElement.classList.contains('piano-key')) {
            const el = e.target.classList.contains('piano-key') ? e.target : e.target.parentElement;
            const note = parseInt(el.dataset.note);
            AudioEngine.init();
            AudioEngine.resume();
            AudioEngine.synth.playNote(note + 24, AudioEngine.currentTime, 0.5, 100, 'instrument');
        }
    });

    const scrollContainer = DOM.el('piano-roll-container');
    scrollContainer.addEventListener('scroll', () => {
        State.project.view.scrollX = scrollContainer.scrollLeft;
        State.project.view.scrollY = scrollContainer.scrollTop;
    });

    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const keyMap = {
            'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71,
            'k': 72, 'o': 73, 'l': 74, 'p': 75, ';': 76, '\'': 77
        };
        if (keyMap[e.key]) {
            AudioEngine.init();
            AudioEngine.resume();
            AudioEngine.synth.playNote(keyMap[e.key] + (State.project.view.octaveShift * 12), AudioEngine.currentTime, 0.5, 100, 'instrument');
            const keyEl = document.querySelector(`[data-note="${keyMap[e.key] - 36}"]`); 
            if(keyEl) keyEl.classList.add('active');
        }
    });

    window.addEventListener('keyup', (e) => {
        const keyMap = {
             'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71,
            'k': 72, 'o': 73, 'l': 74, 'p': 75, ';': 76, '\'': 77
        };
        if (keyMap[e.key]) {
             const keyEl = document.querySelector(`[data-note="${keyMap[e.key] - 36}"]`); 
             if(keyEl) keyEl.classList.remove('active');
        }
    });
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
            PianoRoll.render();
        };
        container.appendChild(div);
    });
};

const handleResize = () => {
    const canvasContainer = DOM.el('piano-roll-container');
    const gridCanvas = DOM.el('grid-canvas');
    const notesCanvas = DOM.el('notes-canvas');
    if(canvasContainer && gridCanvas && notesCanvas) {
        gridCanvas.width = canvasContainer.clientWidth;
        gridCanvas.height = canvasContainer.clientHeight;
        notesCanvas.width = canvasContainer.clientWidth;
        notesCanvas.height = canvasContainer.clientHeight;
        PianoRoll.render();
    }
    const kb = DOM.el('virtual-keyboard-wrapper');
    if(kb) kb.style.width = '100%'; 
};

const setupKeyboardLayout = () => {
    const kb = DOM.el('virtual-keyboard');
    kb.innerHTML = '';
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

const togglePlayButton = (playing) => {
    const btn = DOM.el('btn-play');
    if(playing) {
        btn.innerHTML = '&#10074;&#10074;'; 
        btn.classList.add('active');
    } else {
        btn.innerHTML = '&#9658;';
        btn.classList.remove('active');
    }
};

const uiLoop = () => {
    const timeDisplay = DOM.el('time-display');
    
    if (Sequencer.isPlaying) {
         const totalSeconds = Sequencer.currentSixteenthNote * (60 / Sequencer.bpm) / 4;
         const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
         const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
         const ms = Math.floor((totalSeconds % 1) * 100).toString().padStart(2, '0');
         timeDisplay.innerText = `${mins}:${secs}:${ms}`;
         
         const playhead = DOM.el('playhead');
         const view = State.project.view;
         const beatW = PianoRoll.config.beatWidth * view.zoomX;
         const px = (Sequencer.currentSixteenthNote / 4) * beatW - view.scrollX + PianoRoll.config.keysWidth;
         playhead.style.left = `${px}px`;
    }
    
    PianoRoll.render();
    requestAnimationFrame(uiLoop);
};

window.addEventListener('DOMContentLoaded', init);