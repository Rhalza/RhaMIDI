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
    setupToolBar();
    setupKeyboardLayout();
    
    State.on('projectLoaded', () => {
        renderTrackList();
        PianoRoll.render();
        Inspector.render();
    });
    
    requestAnimationFrame(uiLoop);

    // Initial scroll
    setTimeout(() => {
        const vp = DOM.el('piano-roll-viewport');
        if(vp) vp.scrollTop = 1500; 
        PianoRoll.render();
        setupKeyboardLayout();
    }, 100);
};

const setupToolBar = () => {
    const tools = ['draw', 'select', 'delete'];
    if (!State.tool) State.tool = 'draw';
    tools.forEach(t => {
        DOM.on(`tool-${t}`, 'click', () => {
            State.tool = t;
            tools.forEach(ot => DOM.el(`tool-${ot}`).classList.remove('active'));
            DOM.el(`tool-${t}`).classList.add('active');
        });
    });
};

const setupEventListeners = () => {
    DOM.on('btn-play', 'click', () => {
        if(Sequencer.isPlaying) { Sequencer.stop(); togglePlayButton(false); }
        else { Sequencer.play(); togglePlayButton(true); }
    });

    DOM.on('btn-stop', 'click', () => {
        Sequencer.stop();
        togglePlayButton(false);
        DOM.el('time-display').innerText = "00:00:00";
        Sequencer.rewind();
        DOM.el('playhead').style.left = '0px';
    });

    DOM.on('btn-rewind', 'click', () => {
        Sequencer.rewind();
        DOM.el('playhead').style.left = '0px';
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

    DOM.on('grid-snap-select', 'change', (e) => {
        State.project.view.snapToGrid = e.target.value;
    });

    // Magnet Button
    const magBtn = DOM.el('magnet-btn-wrapper');
    if(magBtn) {
        magBtn.onclick = () => {
            State.project.view.magnetEnabled = !State.project.view.magnetEnabled;
            DOM.el('icon-magnet').style.color = State.project.view.magnetEnabled ? '#00bcd4' : '#666';
        };
    }

    // Octave Buttons
    DOM.on('btn-octave-up', 'click', () => {
        if(State.project.view.octaveShift < 3) {
            State.project.view.octaveShift++;
            DOM.el('current-octave').innerText = `Oct ${State.project.view.octaveShift + 4}`;
            setupKeyboardLayout();
        }
    });

    DOM.on('btn-octave-down', 'click', () => {
        if(State.project.view.octaveShift > -3) {
            State.project.view.octaveShift--;
            DOM.el('current-octave').innerText = `Oct ${State.project.view.octaveShift + 4}`;
            setupKeyboardLayout();
        }
    });

    // Keyboard Resize
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
        }
    });
    window.addEventListener('mouseup', () => {
        isResizingKb = false;
        document.body.style.cursor = 'default';
    });

    // Ruler Scroll Sync
    const vp = DOM.el('piano-roll-viewport');
    vp.addEventListener('scroll', () => {
        State.project.view.scrollX = vp.scrollLeft;
        State.project.view.scrollY = vp.scrollTop;
        DOM.el('ruler-scroll-area').scrollLeft = vp.scrollLeft;
        // Also sync sticky keys
        DOM.el('sticky-keys').scrollTop = vp.scrollTop;
    });

    // PC Keyboard
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; 
        if (e.repeat) return;
        if (e.code === 'Space') {
            e.preventDefault();
            if(Sequencer.isPlaying) { Sequencer.stop(); togglePlayButton(false); }
            else { Sequencer.play(); togglePlayButton(true); }
            return;
        }

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

    setupDropdowns();
};

const setupDropdowns = () => {
    const btnProject = DOM.el('btn-project');
    const menuProject = createDropdown([
        { text: 'Load Project', icon: 'fa-folder-open', cb: () => DOM.el('file-import-input').click() },
        { text: 'Save Project', icon: 'fa-floppy-disk', cb: () => Exporter.exportProject('rhal') },
        { separator: true },
        { text: 'Export WAV', icon: 'fa-file-audio', cb: () => Exporter.exportProject('wav') },
        { text: 'Export MP3', icon: 'fa-file-audio', cb: () => Exporter.exportProject('mp3') }
    ]);
    
    btnProject.onclick = (e) => toggleDropdown(e, menuProject);
    DOM.on('file-import-input', 'change', (e) => Importer.handleFileSelect(e));

    const btnOptions = DOM.el('btn-options');
    const menuOptions = createDropdown([
        { text: 'Theme Settings (Coming Soon)', icon: 'fa-palette', cb: () => {} },
        { text: 'Audio Settings (Coming Soon)', icon: 'fa-sliders', cb: () => {} }
    ]);
    btnOptions.onclick = (e) => toggleDropdown(e, menuOptions);
};

function createDropdown(items) {
    const d = DOM.create('div', 'dropdown-menu');
    d.style.display = 'none';
    document.body.appendChild(d);
    
    items.forEach(item => {
        if (item.separator) {
            d.appendChild(DOM.create('div', 'dropdown-separator'));
        } else {
            const b = DOM.create('button', '', `<i class="fa-solid ${item.icon}"></i> ${item.text}`);
            b.onclick = () => { item.cb(); d.style.display = 'none'; };
            d.appendChild(b);
        }
    });
    return d;
}

function toggleDropdown(e, menu) {
    e.stopPropagation();
    const isVis = menu.style.display === 'block';
    document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
    
    if (!isVis) {
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        
        const close = () => {
            menu.style.display = 'none';
            document.removeEventListener('click', close);
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }
}

const renderTrackList = () => {
    const container = DOM.el('track-list-container');
    container.innerHTML = '';
    State.project.tracks.forEach(track => {
        const div = DOM.create('div', 'track-control');
        if (track.selected) div.classList.add('selected');
        
        div.innerHTML = `
            <div style="font-weight:700; color:${track.color}; display:flex; justify-content:space-between;">
                <span>${track.name}</span>
                <i class="fa-solid fa-ellipsis-vertical track-opts-btn" style="cursor:pointer; color:#777;"></i>
            </div>
            <div style="margin-top:5px; display:flex; gap:5px;">
                <button class="small-btn" id="mute-${track.id}" style="color:${track.muted?'red':'white'}">M</button>
                <button class="small-btn" id="solo-${track.id}" style="color:${track.soloed?'yellow':'white'}">S</button>
                <input type="range" min="0" max="1" step="0.01" value="${track.volume}" style="width:60px; accent-color:#00bcd4;">
            </div>
        `;

        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.classList.contains('track-opts-btn')) {
                State.project.tracks.forEach(t => t.selected = false);
                track.selected = true;
                renderTrackList();
                PianoRoll.render();
                Inspector.render();
            }
        };

        const optBtn = div.querySelector('.track-opts-btn');
        optBtn.onclick = (e) => {
            const menu = createDropdown([
                { text: 'Rename', icon: 'fa-pen', cb: () => { const n = prompt("Track Name:", track.name); if(n) { track.name = n; renderTrackList(); }}},
                { text: 'Duplicate', icon: 'fa-copy', cb: () => { const n = JSON.parse(JSON.stringify(track)); n.id = State.project.tracks.length + 1; n.name += " (Copy)"; State.project.tracks.push(n); renderTrackList(); }},
                { text: 'Delete', icon: 'fa-trash', cb: () => { if(confirm("Delete?")) { State.project.tracks = State.project.tracks.filter(t => t.id !== track.id); if(State.project.tracks.length) State.project.tracks[0].selected = true; renderTrackList(); PianoRoll.render(); }}}
            ]);
            toggleDropdown(e, menu);
        };
        
        container.appendChild(div);
    });
};

const setupKeyboardLayout = () => {
    const kb = DOM.el('virtual-keyboard');
    kb.innerHTML = '';
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const keyMapReverse = {
        0: 'A', 1: 'W', 2: 'S', 3: 'E', 4: 'D', 5: 'F', 6: 'T', 7: 'G', 8: 'Y', 9: 'H', 10: 'U', 11: 'J',
        12: 'K', 13: 'O', 14: 'L', 15: 'P', 16: ';', 17: '\''
    };

    // Range C2 (36) to C7 (96)
    for(let i=36; i<97; i++) {
        const octave = Math.floor(i / 12) - 1; 
        const noteIdx = i % 12;
        const noteName = notes[noteIdx];
        const isBlack = noteName.includes('#');
        const key = DOM.create('div', `piano-key ${isBlack ? 'key-black' : 'key-white'}`);
        key.dataset.note = i; 
        
        // Label Mapping relative to octave shift
        // Current Shift 0 means 60 is Middle C. 
        // 60-77 are mapped to keys.
        // baseKey = 60 + (shift * 12).
        const startMapNote = 60 + (State.project.view.octaveShift * 12);
        const diff = i - startMapNote;
        
        let labelHtml = '';
        if (diff >= 0 && diff <= 17) {
             labelHtml = `<span class="key-label" style="color:${isBlack?'#aaa':'#555'}; font-weight:bold;">${keyMapReverse[diff] || ''}</span>`;
        } else if (!isBlack && noteIdx === 0) {
             labelHtml = `<span class="key-label">C${octave}</span>`;
        }

        key.innerHTML = labelHtml;
        
        key.addEventListener('mousedown', () => {
            AudioEngine.init();
            AudioEngine.resume();
            const track = State.currentTrack;
            AudioEngine.synth.playNote(i, AudioEngine.currentTime, 0.5, 100, 'instrument', track ? track.effectsData : []);
            key.classList.add('active');
            setTimeout(() => key.classList.remove('active'), 200);
        });

        kb.appendChild(key);
    }
};

const togglePlayButton = (playing) => {
    const btn = DOM.el('btn-play');
    btn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    playing ? btn.classList.add('active') : btn.classList.remove('active');
};

const uiLoop = () => {
    if (Sequencer.isPlaying) {
         const t = Sequencer.currentSixteenthNote * (60 / Sequencer.bpm) / 4;
         const mins = Math.floor(t / 60).toString().padStart(2, '0');
         const secs = Math.floor(t % 60).toString().padStart(2, '0');
         const ms = Math.floor((t % 1) * 100).toString().padStart(2, '0');
         DOM.el('time-display').innerText = `${mins}:${secs}:${ms}`;
         
         const view = State.project.view;
         const bw = PianoRoll.config.beatWidth * view.zoomX;
         const px = (Sequencer.currentSixteenthNote / 4) * bw;
         DOM.el('playhead').style.left = `${px}px`;
    }
    requestAnimationFrame(uiLoop);
};

window.addEventListener('DOMContentLoaded', init);