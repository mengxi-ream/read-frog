export class SubtitlesError extends Error {
    code;
    constructor(code) {
        super(code);
        this.name = "SubtitlesError";
        this.code = code;
    }
}
export class ToastSubtitlesError extends SubtitlesError {
    constructor(code) {
        super(code);
        this.name = "ToastSubtitlesError";
    }
}
export class OverlaySubtitlesError extends SubtitlesError {
    constructor(code) {
        super(code);
        this.name = "OverlaySubtitlesError";
    }
}
