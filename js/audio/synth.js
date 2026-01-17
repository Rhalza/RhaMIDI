export class Synthesizer {
    constructor(ctx, dest) {
        this.ctx = ctx;
        this.destination = dest;
        this.activeVoices = {};
    }

    playNote(note, time, duration, velocity, instrumentType) {
        if (instrumentType === 'sampler') {
            return; 
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const freq = 440 * Math.pow(2, (note - 69) / 12);
        osc.frequency.value = freq;
        osc.type = 'sawtooth';

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400 + (velocity * 20), time);
        filter.frequency.exponentialRampToValueAtTime(200, time + duration);

        const velGain = velocity / 127;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(velGain, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.destination);

        osc.start(time);
        osc.stop(time + duration + 0.2);

        this.activeVoices[`${note}-${time}`] = osc;
        
        osc.onended = () => {
            delete this.activeVoices[`${note}-${time}`];
        };
    }

    stopAll() {
        Object.values(this.activeVoices).forEach(osc => {
            try { osc.stop(); } catch(e) {}
        });
        this.activeVoices = {};
    }
}