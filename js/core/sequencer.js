import { AudioEngine } from '../audio/audioEngine.js';
import { State } from './state.js';

export const Sequencer = {
    isPlaying: false,
    nextNoteTime: 0.0,
    currentSixteenthNote: 0, // 4 sixteenths = 1 beat
    timerID: null,
    bpm: 120,
    lookahead: 25.0,
    scheduleAheadTime: 0.1,

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
        // Do not reset currentSixteenthNote so we can pause/resume or stop and stay
    },

    rewind() {
        this.currentSixteenthNote = 0;
    },

    setTime(beat) {
        // beat is float, convert to 16th note index
        this.currentSixteenthNote = Math.floor(beat * 4);
    },

    scheduler() {
        while (this.nextNoteTime < AudioEngine.currentTime + this.scheduleAheadTime) {
            this.scheduleNotes();
            this.advanceNote();
        }
    },

    advanceNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        // 0.25 because we advance by 16th notes
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.currentSixteenthNote++;
    },

    scheduleNotes() {
        const beatIndex = this.currentSixteenthNote / 4.0;
        
        State.project.tracks.forEach(track => {
            if (track.muted) return;
            track.events.forEach(event => {
                // Check if note starts within this 16th note window
                // Floating point comparison epsilon
                if (event.type === 'note' && event.start >= beatIndex && event.start < beatIndex + 0.25) {
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