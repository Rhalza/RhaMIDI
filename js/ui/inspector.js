import { State } from '../core/state.js';
import { DOM } from './dom.js';

export const Inspector = {
    init() {
        const btnAdd = DOM.el('btn-add-fx');
        if (btnAdd) {
            btnAdd.onclick = () => this.showFxMenu();
        }
        this.render();
    },

    render() {
        const list = DOM.el('fx-list');
        if (!list) return;
        list.innerHTML = '';

        const track = State.currentTrack;
        if (!track) {
            list.innerHTML = '<div style="color:#666; padding:10px;">No Track Selected</div>';
            return;
        }

        if (!track.effectsData) track.effectsData = [];

        track.effectsData.forEach((fx, index) => {
            const el = DOM.create('div', 'fx-item');
            el.style.cssText = 'background:#222; margin-bottom:5px; padding:5px; border:1px solid #444; border-radius:4px;';
            
            let controls = '';
            
            if (fx.type === 'reverb') {
                controls = `
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                        <label>Mix</label>
                        <input type="range" min="0" max="1" step="0.01" value="${fx.params.mix}" data-p="mix">
                    </div>
                `;
            } else if (fx.type === 'delay') {
                controls = `
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:2px;">
                        <label>Time</label>
                        <input type="range" min="0" max="1" step="0.01" value="${fx.params.time}" data-p="time">
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                        <label>Fdbk</label>
                        <input type="range" min="0" max="0.9" step="0.01" value="${fx.params.feedback}" data-p="feedback">
                    </div>
                `;
            } else if (fx.type === 'distortion') {
                controls = `
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                        <label>Drive</label>
                        <input type="range" min="0" max="400" step="10" value="${fx.params.drive}" data-p="drive">
                    </div>
                `;
            }

            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px;">
                    <span style="color:#00e5ff; font-weight:bold; text-transform:capitalize;">${fx.type}</span>
                    <button class="small-btn remove-fx" data-idx="${index}" style="color:red;">x</button>
                </div>
                ${controls}
            `;

            const inputs = el.querySelectorAll('input');
            inputs.forEach(inp => {
                inp.oninput = (e) => {
                    const val = parseFloat(e.target.value);
                    const param = e.target.dataset.p;
                    fx.params[param] = val;
                };
            });

            const rmBtn = el.querySelector('.remove-fx');
            rmBtn.onclick = () => {
                track.effectsData.splice(index, 1);
                this.render();
            };

            list.appendChild(el);
        });
    },

    showFxMenu() {
        const track = State.currentTrack;
        if (!track) return;
        
        const existing = document.getElementById('fx-menu');
        if (existing) existing.remove();

        const menu = DOM.create('div', 'dropdown-menu');
        menu.id = 'fx-menu';
        menu.style.cssText = 'position:absolute; bottom:100px; right:200px; background:#333; border:1px solid #555; z-index:200; display:flex; flex-direction:column; padding:5px;';
        
        const add = (type) => {
            const btn = DOM.create('button', '', type);
            btn.onclick = () => {
                if (!track.effectsData) track.effectsData = [];
                
                let defaults = {};
                if (type === 'reverb') defaults = { mix: 0.3, time: 2.0 };
                if (type === 'delay') defaults = { time: 0.4, feedback: 0.3, mix: 0.5 };
                if (type === 'distortion') defaults = { drive: 50 };

                track.effectsData.push({ type: type, params: defaults });
                this.render();
                menu.remove();
            };
            menu.appendChild(btn);
        };

        add('reverb');
        add('delay');
        add('distortion');

        document.body.appendChild(menu);
        
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target.id !== 'btn-add-fx') {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 100);
    }
};