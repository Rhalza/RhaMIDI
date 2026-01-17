import { Effects } from './effects.js';

export class Synthesizer {
    constructor(ctx, dest) {
        this.ctx = ctx;
        this.destination = dest;
        this.activeVoices = {};
    }

    playNote(note, time, duration, velocity, trackType, trackEffects = []) {
        // Create voice chain
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const freq = 440 * Math.pow(2, (note - 69) / 12);
        osc.frequency.value = freq;
        osc.type = trackType === 'bass' ? 'sawtooth' : 'sine';
        if (trackType === 'lead') osc.type = 'square';

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800 + (velocity * 30), time);
        
        const velGain = velocity / 127;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(velGain, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.1);

        osc.connect(filter);
        filter.connect(gain);

        // Build Track FX Chain
        let lastNode = gain;
        const fxNodes = []; 

        if (trackEffects && trackEffects.length > 0) {
            trackEffects.forEach(fxData => {
                let fxInstance;
                if (fxData.type === 'reverb') fxInstance = Effects.createReverb(this.ctx);
                if (fxData.type === 'delay') fxInstance = Effects.createDelay(this.ctx);
                if (fxData.type === 'distortion') fxInstance = Effects.createDistortion(this.ctx);
                
                if (fxInstance) {
                    // Apply saved params
                    Object.keys(fxData.params).forEach(k => fxInstance.set(k, fxData.params[k]));
                    
                    lastNode.connect(fxInstance.input);
                    lastNode = fxInstance.output;
                    fxNodes.push(fxInstance); // Keep ref to prevent GC issues during play
                }
            });
        }

        lastNode.connect(this.destination);

        osc.start(time);
        osc.stop(time + duration + 0.2);

        this.activeVoices[`${note}-${time}`] = { osc, fxNodes };
        
        osc.onended = () => {
            delete this.activeVoices[`${note}-${time}`];
        };
    }

    stopAll() {
        Object.values(this.activeVoices).forEach(v => {
            try { v.osc.stop(); } catch(e) {}
        });
        this.activeVoices = {};
    }
}