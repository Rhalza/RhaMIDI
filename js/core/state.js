export const State = {
    project: {
        meta: {
            name: "Untitled Project",
            version: "1.0",
            bpm: 120,
            timeSignature: [4, 4]
        },
        view: {
            zoomX: 1.0,
            zoomY: 1.0,
            totalBeats: 8, 
            snapToGrid: "1/4",
            magnetEnabled: true,
            octaveShift: 0
        },
        tracks: [] 
    },
    
    lastNoteDuration: 1.0,
    tool: 'draw', 
    
    get currentTrack() {
        return this.project.tracks.find(t => t.selected);
    },

    createNewTrack(type = "instrument") {
        const id = this.project.tracks.length + 1;
        return {
            id: id,
            name: `Track ${id}`,
            type: type,
            instrument: "sine", 
            muted: false,
            soloed: false,
            selected: false,
            volume: 0.8,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            effectsData: [], 
            events: [] 
        };
    },

    loadProject(rhalData) {
        this.project = rhalData;
        if (!this.project.view.totalBeats) this.project.view.totalBeats = 8;
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