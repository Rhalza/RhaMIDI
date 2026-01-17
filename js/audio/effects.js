export const Effects = {
    // Helper for wet/dry
    createWetDry(ctx, input, output, wetNode, dryNode, mixVal) {
        wetNode.gain.value = mixVal;
        dryNode.gain.value = 1.0 - mixVal;
        return {
            setMix(val) {
                wetNode.gain.value = val;
                dryNode.gain.value = 1.0 - val;
            }
        };
    },

    createReverb(ctx) {
        const convolver = ctx.createConvolver();
        const input = ctx.createGain();
        const output = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();

        // Impulse Response
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

        const mixControl = this.createWetDry(ctx, input, output, wet, dry, 0.3);

        return {
            type: 'reverb', input, output,
            params: { mix: 0.3 },
            set(k, v) { if(k==='mix') mixControl.setMix(v); }
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

        const mixControl = this.createWetDry(ctx, input, output, wet, dry, 0.5);

        return {
            type: 'delay', input, output,
            params: { time: 0.4, feedback: 0.3, mix: 0.5 },
            nodes: { delay, feedback },
            set(k, v) {
                if(k==='time') this.nodes.delay.delayTime.value = v;
                if(k==='feedback') this.nodes.feedback.gain.value = v;
                if(k==='mix') mixControl.setMix(v);
            }
        };
    },

    createDistortion(ctx) {
        const shaper = ctx.createWaveShaper();
        const input = ctx.createGain();
        const output = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();

        function makeCurve(amount) {
            const k = amount;
            const n = 44100;
            const curve = new Float32Array(n);
            const deg = Math.PI / 180;
            for (let i=0; i<n; ++i ) {
                const x = i * 2 / n - 1;
                curve[i] = (3+k)*x*20*deg / (Math.PI + k*Math.abs(x));
            }
            return curve;
        }

        shaper.curve = makeCurve(50);
        shaper.oversample = '4x';

        input.connect(dry);
        input.connect(shaper);
        shaper.connect(wet);
        wet.connect(output);
        dry.connect(output);

        const mixControl = this.createWetDry(ctx, input, output, wet, dry, 1.0); 

        return {
            type: 'distortion', input, output,
            params: { drive: 50, mix: 1.0 },
            nodes: { shaper },
            set(k, v) {
                if(k==='drive') this.nodes.shaper.curve = makeCurve(v);
                if(k==='mix') mixControl.setMix(v);
            }
        };
    },

    createChorus(ctx) {
        const input = ctx.createGain();
        const output = ctx.createGain();
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        
        const delayL = ctx.createDelay();
        const delayR = ctx.createDelay();
        const osc = ctx.createOscillator();
        const oscGainL = ctx.createGain();
        const oscGainR = ctx.createGain();

        delayL.delayTime.value = 0.03;
        delayR.delayTime.value = 0.03;
        osc.type = 'sine';
        osc.frequency.value = 1.5;
        oscGainL.gain.value = 0.002;
        oscGainR.gain.value = -0.002; // Phase inverted modulation

        osc.connect(oscGainL);
        osc.connect(oscGainR);
        oscGainL.connect(delayL.delayTime);
        oscGainR.connect(delayR.delayTime);

        input.connect(dry);
        input.connect(splitter);
        splitter.connect(delayL, 0);
        splitter.connect(delayR, 1);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(wet);
        wet.connect(output);
        dry.connect(output);
        
        osc.start();

        const mixControl = this.createWetDry(ctx, input, output, wet, dry, 0.5);

        return {
            type: 'chorus', input, output,
            params: { rate: 1.5, depth: 0.002, mix: 0.5 },
            nodes: { osc, oscGainL, oscGainR },
            set(k,v) {
                if(k==='rate') this.nodes.osc.frequency.value = v;
                if(k==='depth') { this.nodes.oscGainL.gain.value = v; this.nodes.oscGainR.gain.value = -v; }
                if(k==='mix') mixControl.setMix(v);
            }
        };
    }
};