/* Sound functions */

class Sound {
    audio : HTMLAudioElement;

    constructor(url : string) {
        this.audio = new Audio(url);
        this.audio.load();
    }

    play() {
        this.audio.play();
    }

    setLoop(loop : boolean) {
        this.audio.loop = loop;
    }

    setVolume(volume : number) {
        this.audio.volume = volume;
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    pause() {
        this.audio.pause();
    }
}

export class Music extends Sound {
    constructor(url : string) {
        super(url);
        this.setLoop(true);
    }
}

export class SoundEffect extends Sound {
    constructor(url : string) {
        super(url);
        this.setLoop(false);
    }
}
