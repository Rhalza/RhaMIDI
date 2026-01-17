export const State = {
    project: {
        meta: {
            name: "Untitled Project",
            version: "1.0",
            author: "User",
            created: Date.now(),
            bpm: 120,
            timeSignature: [4, 4],
            keySignature: "C",
            ppq: 96 
        },
        view: {
            zoomX: 1.0,
            zoomY: 1.0,
            scrollX: 0,
            scrollY: 0,
            snapToGrid: "1/4",
            octaveShift: 0
        },
        mixer: {
            masterVolume: 1.0,
            globalEffects: [] 
        },
        tracks: [] 
    },
    
    clipboard: null,
    history: [],
    historyIndex: -1,

    get currentTrack() {
        return this.project.tracks.find(t => t.selected);
    },

    createNewTrack(type = "instrument") {
        const id = this.project.tracks.length + 1;
        return {
            id: id,
            name: `Track ${id}`,
            type: type,
            instrument: "default_sine", 
            muted: false,
            soloed: false,
            selected: false,
            volume: 0.8,
            pan: 0,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            effects: [], 
            automation: [],
            events: [] 
        };
    },

    loadProject(rhalData) {
        this.project = rhalData;
        this.emit("projectLoaded");
    },

    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
};

export const FXPresets = {
    savePreset(effectChain) {
        const data = {
            type: "rhalfx",
            version: "1.0",
            chain: effectChain
        };
        return JSON.stringify(data);
    }
};