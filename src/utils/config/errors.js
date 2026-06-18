export class ConfigVersionTooNewError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigVersionTooNewError";
    }
}
