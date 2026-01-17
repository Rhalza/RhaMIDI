import { AudioEngine } from '../audio/audioEngine.js';
import { State } from './state.js';

export const Sequencer = {
    isPlaying: false,
    startTime: 0,
    pauseTime: 0,
    lookahead: 25.0,
    scheduleAheadTime: 0.1,
    nextNoteTime: 0.0,
    currentSixteenthNote: 0,
    timerID: null,
    bpm: 120,

    init() {
        this.bpm = State.project.meta.bpm;
    },

    play() {
        if (this.isPlaying) return;
        
        AudioEngine.init();
        AudioEngine.resume();
        
        this.isPlaying = true;
        this.nextNoteTime = AudioEngine.currentTime;
        this.timerID = setInterval(() => this.scheduler(), this.lookahead);
    },

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
        AudioEngine.stopAll();
        this.currentSixteenthNote = 0;
    },

    scheduler() {
        while (this.nextNoteTime < AudioEngine.currentTime + this.scheduleAheadTime) {
            this.scheduleNotes();
            this.advanceNote();
        }
        State.emit('transport', this.currentSixteenthNote);
    },

    advanceNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.currentSixteenthNote++;
    },

    scheduleNotes() {
        const beatIndex = this.currentSixteenthNote / 4; 
        
        State.project.tracks.forEach(track => {
            if (track.muted) return;
            
            track.events.forEach(event => {
                if (event.type === 'note' && Math.abs(event.start - beatIndex) < 0.01) {
                    AudioEngine.scheduleNote(
                        track,
                        event.note,
                        this.nextNoteTime,
                        event.duration * (60.0 / this.bpm), 
                        event.velocity
                    );
                }
            });
        });
    },
    
    setBpm(bpm) {
        this.bpm = bpm;
        State.project.meta.bpm = bpm;
    }
};