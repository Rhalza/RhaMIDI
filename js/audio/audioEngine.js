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
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        this.synth = new Synthesizer(this.ctx, this.masterGain);
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
        this.synth.playNote(
            note, 
            start, 
            duration, 
            velocity, 
            track.instrument, // Instrument type string
            track.effectsData // Pass the track's FX chain
        );
    },

    stopAll() {
        if (this.synth) this.synth.stopAll();
    }
};