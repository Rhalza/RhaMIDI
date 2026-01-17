export const Effects = {
    createReverb(ctx, seconds = 2, decay = 2, reverse = false) {
        const rate = ctx.sampleRate;
        const length = rate * seconds;
        const impulse = ctx.createBuffer(2, length, rate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = reverse ? length - i : i;
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        }

        const convolver = ctx.createConvolver();
        convolver.buffer = impulse;
        
        const input = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const output = ctx.createGain();

        input.connect(dry);
        input.connect(convolver);
        convolver.connect(wet);
        dry.connect(output);
        wet.connect(output);

        wet.gain.value = 0.3;
        dry.gain.value = 1.0;

        return { input, output, wet, dry, node: output };
    },

    createDelay(ctx, time = 0.5, feedbackVal = 0.4) {
        const delay = ctx.createDelay(5.0);
        const feedback = ctx.createGain();
        const input = ctx.createGain();
        const output = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();

        delay.delayTime.value = time;
        feedback.gain.value = feedbackVal;

        input.connect(dry);
        input.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        
        dry.connect(output);
        wet.connect(output);

        return { input, output, wet, dry, delayNode: delay, feedbackNode: feedback };
    }
};