import { State } from './core/state.js';
import { DOM } from './ui/dom.js';
import { Sequencer } from './core/sequencer.js';
import { AudioEngine } from './audio/audioEngine.js';
import { PianoRoll } from './ui/pianoRoll.js';
import { Importer } from './core/importer.js';
import { Exporter } from './core/exporter.js';
import { Interaction } from './ui/interaction.js';
import { Inspector } from './ui/inspector.js';

const init = () => {
    localforage.config({ name: 'RhaMIDI', storeName: 'soundfonts' });

    Sequencer.init();
    PianoRoll.init();
    Interaction.init();
    Inspector.init();

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
        Inspector.render();
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

    DOM.on('btn-add-track', 'click', () => {
        const t = State.createNewTrack();
        State.project.tracks.forEach(track => track.selected = false);
        t.selected = true;
        State.project.tracks.push(t);
        renderTrackList();
        PianoRoll.render();
        Inspector.render();
    });

    DOM.on('icon-magnet', 'click', (e) => {
        State.project.view.magnetEnabled = !State.project.view.magnetEnabled;
        e.target.style.color = State.project.view.magnetEnabled ? '#00bcd4' : '#666';
    });

    DOM.on('grid-snap-select', 'change', (e) => {
        State.project.view.snapToGrid = e.target.value;
    });

    DOM.on('btn-project', 'click', () => {
        const input = DOM.el('file-import-input');
        input.click();
    });
    DOM.on('file-import-input', 'change', (e) => Importer.handleFileSelect(e));

    // Virtual Keyboard Logic
    const kb = DOM.el('virtual-keyboard');
    kb.addEventListener('mousedown', (e) => {
        if(e.target.classList.contains('piano-key') || e.target.parentElement.classList.contains('piano-key')) {
            const el = e.target.classList.contains('piano-key') ? e.target : e.target.parentElement;
            const note = parseInt(el.dataset.note); // This is absolute MIDI note now
            
            AudioEngine.init();
            AudioEngine.resume();
            const track = State.currentTrack;
            AudioEngine.synth.playNote(note, AudioEngine.currentTime, 0.5, 100, 'instrument', track ? track.effectsData : []);
            
            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 200);
        }
    });

    // Keyboard Resizing
    const handle = DOM.el('kb-resize-handle');
    let isResizingKb = false;
    let startY = 0;
    let startH = 0;
    
    handle.addEventListener('mousedown', (e) => {
        isResizingKb = true;
        startY = e.clientY;
        startH = DOM.el('virtual-keyboard-wrapper').offsetHeight;
        document.body.style.cursor = 'ns-resize';
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isResizingKb) return;
        const delta = startY - e.clientY; 
        const newH = startH + delta;
        if (newH > 50 && newH < 400) {
            DOM.el('virtual-keyboard-wrapper').style.height = `${newH}px`;
            handleResize(); // trigger canvas resize
        }
    });
    
    window.addEventListener('mouseup', () => {
        isResizingKb = false;
        document.body.style.cursor = 'default';
    });


    // Piano Roll Scrolling
    const scrollContainer = DOM.el('piano-roll-container');
    scrollContainer.addEventListener('scroll', () => {
        State.project.view.scrollX = scrollContainer.scrollLeft;
        State.project.view.scrollY = scrollContainer.scrollTop;
    });

    DOM.on('btn-octave-up', 'click', () => {
        if (State.project.view.octaveShift < 3) {
            State.project.view.octaveShift++;
            DOM.el('current-octave').innerText = `Oct ${State.project.view.octaveShift + 4}`;
            setupKeyboardLayout(); // Re-render labels
        }
    });

    DOM.on('btn-octave-down', 'click', () => {
        if (State.project.view.octaveShift > -3) {
            State.project.view.octaveShift--;
            DOM.el('current-octave').innerText = `Oct ${State.project.view.octaveShift + 4}`;
            setupKeyboardLayout();
        }
    });

    // Computer Keyboard Input
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; 
        if (e.repeat) return;
        const keyMap = {
            'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71,
            'k': 72, 'o': 73, 'l': 74, 'p': 75, ';': 76, '\'': 77
        };
        if (keyMap[e.key]) {
            AudioEngine.init();
            AudioEngine.resume();
            const note = keyMap[e.key] + (State.project.view.octaveShift * 12);
            if (note >= 0 && note <= 127) {
                const track = State.currentTrack;
                AudioEngine.synth.playNote(note, AudioEngine.currentTime, 0.5, 100, 'instrument', track ? track.effectsData : []);
                
                const keyEl = document.querySelector(`[data-note="${note}"]`); 
                if(keyEl) keyEl.classList.add('active');
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        const keyMap = {
             'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71,
            'k': 72, 'o': 73, 'l': 74, 'p': 75, ';': 76, '\'': 77
        };
        if (keyMap[e.key]) {
             const note = keyMap[e.key] + (State.project.view.octaveShift * 12);
             const keyEl = document.querySelector(`[data-note="${note}"]`); 
             if(keyEl) keyEl.classList.remove('active');
        }
    });

    setupMenuButtons();
};

const setupMenuButtons = () => {
    const btnContainer = DOM.el('btn-project');
    const existingMenu = document.getElementById('project-menu-dropdown');
    if (existingMenu) existingMenu.remove();

    const menu = DOM.create('div', 'dropdown-menu');
    menu.id = 'project-menu-dropdown';
    menu.style.cssText = 'position:absolute; top:40px; left:10px; background:#333; padding:5px; display:none; flex-direction:column; gap:2px; z-index:1000; border:1px solid #555; box-shadow:0 4px 15px rgba(0,0,0,0.6); width: 180px;';
    
    const mkBtn = (txt, cb) => {
        const b = DOM.create('button', '', txt);
        b.style.textAlign = 'left';
        b.onclick = cb;
        menu.appendChild(b);
    };

    mkBtn('<i class="fa-solid fa-folder-open"></i> Load Project', () => DOM.el('file-import-input').click());
    mkBtn('<i class="fa-solid fa-floppy-disk"></i> Save Project', () => Exporter.exportProject('rhal'));
    mkBtn('<i class="fa-solid fa-file-audio"></i> Export WAV', () => Exporter.exportProject('wav'));
    mkBtn('<i class="fa-solid fa-file-audio"></i> Export MP3', () => Exporter.exportProject('mp3'));

    DOM.el('app-container').appendChild(menu);

    btnContainer.onclick = () => {
        menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    };

    DOM.el('app-container').addEventListener('click', (e) => {
        if (e.target !== btnContainer && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
};

const renderTrackList = () => {
    const container = DOM.el('track-list-container');
    container.innerHTML = '';
    State.project.tracks.forEach(track => {
        const div = DOM.create('div', 'track-control');
        if (track.selected) div.classList.add('selected');
        
        const muteIcon = track.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : 'M';
        const soloIcon = track.soloed ? '<i class="fa-solid fa-star"></i>' : 'S';

        div.innerHTML = `
            <div style="font-weight:700; color:${track.color}; margin-bottom:8px; font-size:0.9rem;">${track.name}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                 <button class="small-btn" id="mute-${track.id}" style="color:${track.muted ? '#ff4444' : '#fff'}; border-color:${track.muted?'#ff4444':'#555'}">${muteIcon}</button>
                 <button class="small-btn" id="solo-${track.id}" style="color:${track.soloed ? '#ffeb3b' : '#fff'}; border-color:${track.soloed?'#ffeb3b':'#555'}">${soloIcon}</button>
                 <input type="range" min="0" max="1" step="0.01" value="${track.volume}" style="width:70px; accent-color:var(--accent);" id="vol-${track.id}" title="Volume">
            </div>
        `;
        div.onclick = (e) => {
            if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'I') return;
            State.project.tracks.forEach(t => t.selected = false);
            track.selected = true;
            renderTrackList();
            PianoRoll.render();
            Inspector.render();
        };

        const mBtn = div.querySelector(`#mute-${track.id}`);
        mBtn.onclick = () => { track.muted = !track.muted; renderTrackList(); };
        
        const sBtn = div.querySelector(`#solo-${track.id}`);
        sBtn.onclick = () => { track.soloed = !track.soloed; renderTrackList(); };

        const vSli = div.querySelector(`#vol-${track.id}`);
        vSli.oninput = (e) => { track.volume = parseFloat(e.target.value); };
        
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
    
    // Reverse map for labels
    const keyMap = {
        60: 'A', 61: 'W', 62: 'S', 63: 'E', 64: 'D', 65: 'F', 66: 'T', 67: 'G', 68: 'Y', 69: 'H', 70: 'U', 71: 'J',
        72: 'K', 73: 'O', 74: 'L', 75: 'P', 76: ';', 77: '\''
    };

    // Range: C2 (36) to C7 (96) approx
    for(let i=36; i<97; i++) {
        const octave = Math.floor(i / 12) - 1; 
        const noteIdx = i % 12;
        const noteName = notes[noteIdx];
        const isBlack = noteName.includes('#');
        const key = DOM.create('div', `piano-key ${isBlack ? 'key-black' : 'key-white'}`);
        key.dataset.note = i; 
        
        // Label logic
        // Calculate which note this would correspond to given the current octave shift
        // If Octave Shift is 0 (Default, Middle C is C4), keys 60-77 map to A-'.
        // We need to find if THIS visual key 'i' corresponds to a key press
        // keyPressNote = mapValue + (shift * 12). 
        // So if i == keyPressNote, label it.
        const effectiveKeyIndex = i - (State.project.view.octaveShift * 12);
        const char = keyMap[effectiveKeyIndex];

        let labelHtml = '';
        if (char) {
             labelHtml = `<span class="key-label" style="color:${isBlack?'#aaa':'#555'}; font-weight:bold;">${char}</span>`;
        } else if (!isBlack && noteIdx === 0) {
             labelHtml = `<span class="key-label">C${octave}</span>`;
        }

        key.innerHTML = labelHtml;
        kb.appendChild(key);
    }
};

const togglePlayButton = (playing) => {
    const btn = DOM.el('btn-play');
    if(playing) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i>'; 
        btn.classList.add('active');
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
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
         if(playhead) {
             playhead.innerHTML = '<div class="playhead-triangle"></div>';
             const view = State.project.view;
             const beatW = PianoRoll.config.beatWidth * view.zoomX;
             const px = (Sequencer.currentSixteenthNote / 4) * beatW - view.scrollX + PianoRoll.config.keysWidth;
             playhead.style.left = `${px}px`;
         }
    }
    
    // We only need to render interaction updates, but PianoRoll is heavy.
    // Interaction handles its own render calls on events. 
    // Just keep Playhead update here.
    if(Sequencer.isPlaying) {
         // requestAnimationFrame handled recursively
    }
    requestAnimationFrame(uiLoop);
};

window.addEventListener('DOMContentLoaded', init);