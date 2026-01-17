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
    
    State.on('projectLoaded', () => {
        renderTrackList();
        PianoRoll.render();
        Inspector.render();
    });
    
    requestAnimationFrame(uiLoop);

    // Initial scroll to center
    setTimeout(() => {
        const vp = DOM.el('piano-roll-viewport');
        if(vp) vp.scrollTop = 1500; 
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
    });

    DOM.on('bpm-input', 'change', (e) => Sequencer.setBpm(parseInt(e.target.value)));

    DOM.on('btn-add-track', 'click', () => {
        const t = State.createNewTrack();
        State.project.tracks.forEach(track => track.selected = false);
        t.selected = true;
        State.project.tracks.push(t);
        renderTrackList();
        PianoRoll.render();
    });

    setupDropdowns();
};

const setupDropdowns = () => {
    // Project Menu
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
            b.onclick = () => {
                item.cb();
                d.style.display = 'none';
            };
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

        // Selection Logic
        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.classList.contains('track-opts-btn')) {
                State.project.tracks.forEach(t => t.selected = false);
                track.selected = true;
                renderTrackList();
                PianoRoll.render();
                Inspector.render();
            }
        };

        // Context Menu
        const optBtn = div.querySelector('.track-opts-btn');
        optBtn.onclick = (e) => {
            const menu = createDropdown([
                { text: 'Rename', icon: 'fa-pen', cb: () => {
                    const n = prompt("Track Name:", track.name);
                    if(n) { track.name = n; renderTrackList(); }
                }},
                { text: 'Duplicate', icon: 'fa-copy', cb: () => {
                    const n = JSON.parse(JSON.stringify(track));
                    n.id = State.project.tracks.length + 1;
                    n.name += " (Copy)";
                    State.project.tracks.push(n);
                    renderTrackList();
                }},
                { text: 'Delete', icon: 'fa-trash', cb: () => {
                    if(confirm("Delete Track?")) {
                        State.project.tracks = State.project.tracks.filter(t => t.id !== track.id);
                        if(State.project.tracks.length) State.project.tracks[0].selected = true;
                        renderTrackList();
                        PianoRoll.render();
                    }
                }},
                { separator: true },
                { text: 'Load SoundFont (Placeholder)', icon: 'fa-music', cb: () => alert("SoundFont Loading logic here") }
            ]);
            toggleDropdown(e, menu);
        };
        
        container.appendChild(div);
    });
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
         DOM.el('time-display').innerText = `${mins}:${secs}:${Math.floor((t%1)*100).toString().padStart(2,'0')}`;
         
         const ph = DOM.el('playhead');
         const view = State.project.view;
         const bw = PianoRoll.config.beatWidth * view.zoomX;
         ph.style.left = `${(Sequencer.currentSixteenthNote / 4) * bw}px`;
    }
    requestAnimationFrame(uiLoop);
};

window.addEventListener('DOMContentLoaded', init);