import { Synthesizer } from './synth.js';
import { Effects } from './effects.js';

export const AudioEngine = {
    ctx: null,
    masterGain: null,
    limiter: null,
    synth: null,
    isInit: false,

    init() {
        if (this.isInit) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;

        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -1;
        this.limiter.knee.value = 40;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.005;
        this.limiter.release.value = 0.25;

        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        this.synth = new Synthesizer(this.ctx, this.masterGain);

        this.reverb = Effects.createReverb(this.ctx);
        this.reverb.wet.gain.value = 0.1;
        
        this.synth.destination.disconnect();
        this.synth.destination.connect(this.reverb.input);
        this.reverb.output.connect(this.masterGain);

        this.isInit = true;
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    get currentTime() {
        return this.ctx ? this.ctx.currentTime : 0;
    },

    scheduleNote(track, note, start, duration, velocity) {
        if (!this.isInit) return;
        this.synth.playNote(note, start, duration, velocity, track.type);
    },

    stopAll() {
        if (this.synth) this.synth.stopAll();
    }
};