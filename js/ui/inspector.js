import { State } from '../core/state.js';
import { DOM } from './dom.js';

export const Inspector = {
    init() {
        const btnAdd = DOM.el('btn-add-fx');
        if (btnAdd) btnAdd.onclick = (e) => this.showFxMenu(e);
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
            
            const makeRange = (label, param, min, max, step) => `
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:2px;">
                    <label>${label}</label>
                    <input type="range" min="${min}" max="${max}" step="${step}" value="${fx.params[param]}" data-p="${param}" style="width:100px; accent-color:#00bcd4;">
                </div>`;

            if (fx.type === 'reverb') {
                controls = makeRange('Mix', 'mix', 0, 1, 0.01);
            } else if (fx.type === 'delay') {
                controls = makeRange('Time', 'time', 0, 1, 0.01) + makeRange('Fdbk', 'feedback', 0, 0.9, 0.01) + makeRange('Mix', 'mix', 0, 1, 0.01);
            } else if (fx.type === 'distortion') {
                controls = makeRange('Drive', 'drive', 0, 400, 10) + makeRange('Mix', 'mix', 0, 1, 0.01);
            } else if (fx.type === 'chorus') {
                controls = makeRange('Rate', 'rate', 0.1, 10, 0.1) + makeRange('Depth', 'depth', 0.001, 0.01, 0.001) + makeRange('Mix', 'mix', 0, 1, 0.01);
            }

            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px;">
                    <span style="color:#00bcd4; font-weight:bold; text-transform:capitalize;">${fx.type}</span>
                    <button class="small-btn remove-fx" data-idx="${index}" style="color:#ff4444;">x</button>
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

            el.querySelector('.remove-fx').onclick = () => {
                track.effectsData.splice(index, 1);
                this.render();
            };
            list.appendChild(el);
        });
    },

    showFxMenu(e) {
        const track = State.currentTrack;
        if (!track) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const existing = document.getElementById('fx-menu');
        if (existing) existing.remove();

        const menu = DOM.create('div', 'dropdown-menu');
        menu.id = 'fx-menu';
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left - 50}px`; 
        
        const add = (type) => {
            const btn = DOM.create('button', '', type.charAt(0).toUpperCase() + type.slice(1));
            btn.onclick = () => {
                if (!track.effectsData) track.effectsData = [];
                let defaults = {};
                if (type === 'reverb') defaults = { mix: 0.3 };
                if (type === 'delay') defaults = { time: 0.4, feedback: 0.3, mix: 0.5 };
                if (type === 'distortion') defaults = { drive: 50, mix: 1.0 };
                if (type === 'chorus') defaults = { rate: 1.5, depth: 0.002, mix: 0.5 };
                track.effectsData.push({ type: type, params: defaults });
                this.render();
                menu.remove();
            };
            menu.appendChild(btn);
        };

        add('reverb');
        add('delay');
        add('distortion');
        add('chorus');

        document.body.appendChild(menu);
        
        const closeHandler = (ev) => {
            if (!menu.contains(ev.target) && ev.target.id !== 'btn-add-fx') {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 100);
    }
};