export const Effects = {
    createReverb(ctx) {
        const convolver = ctx.createConvolver();
        const input = ctx.createGain();
        const output = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();

        const rate = ctx.sampleRate;
        const length = rate * 2.0;
        const impulse = ctx.createBuffer(2, length, rate);
        const l = impulse.getChannelData(0);
        const r = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const dec = Math.pow(1 - i / length, 2.0);
            l[i] = (Math.random() * 2 - 1) * dec;
            r[i] = (Math.random() * 2 - 1) * dec;
        }
        convolver.buffer = impulse;

        input.connect(dry);
        input.connect(convolver);
        convolver.connect(wet);
        wet.connect(output);
        dry.connect(output);

        wet.gain.value = 0.3;
        dry.gain.value = 1.0;

        return {
            type: 'reverb',
            input, output,
            params: { mix: 0.3, time: 2.0 },
            nodes: { wet, dry, convolver },
            set(key, val) {
                if(key === 'mix') {
                    this.params.mix = val;
                    this.nodes.wet.gain.value = val;
                    this.nodes.dry.gain.value = 1.0 - val;
                }
            }
        };
    },

    createDelay(ctx) {
        const delay = ctx.createDelay(5.0);
        const feedback = ctx.createGain();
        const input = ctx.createGain();
        const output = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();

        delay.delayTime.value = 0.4;
        feedback.gain.value = 0.3;

        input.connect(dry);
        input.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(output);
        dry.connect(output);
        
        wet.gain.value = 0.5;

        return {
            type: 'delay',
            input, output,
            params: { time: 0.4, feedback: 0.3, mix: 0.5 },
            nodes: { delay, feedback, wet, dry },
            set(key, val) {
                if(key === 'time') {
                    this.params.time = val;
                    this.nodes.delay.delayTime.value = val;
                } else if (key === 'feedback') {
                    this.params.feedback = val;
                    this.nodes.feedback.gain.value = val;
                } else if (key === 'mix') {
                    this.params.mix = val;
                    this.nodes.wet.gain.value = val;
                    this.nodes.dry.gain.value = 1.0 - val;
                }
            }
        };
    },
    
    createDistortion(ctx) {
        const shaper = ctx.createWaveShaper();
        const input = ctx.createGain();
        const output = ctx.createGain();
        
        function makeCurve(amount) {
            const k = typeof amount === 'number' ? amount : 50;
            const n_samples = 44100;
            const curve = new Float32Array(n_samples);
            const deg = Math.PI / 180;
            for (let i = 0; i < n_samples; ++i ) {
                const x = i * 2 / n_samples - 1;
                curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
            }
            return curve;
        }

        shaper.curve = makeCurve(50);
        shaper.oversample = '4x';
        
        input.connect(shaper);
        shaper.connect(output);

        return {
            type: 'distortion',
            input, output,
            params: { drive: 50 },
            nodes: { shaper },
            set(key, val) {
                if(key === 'drive') {
                    this.params.drive = val;
                    this.nodes.shaper.curve = makeCurve(val);
                }
            }
        };
    }
};