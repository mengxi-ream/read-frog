export function migrate(oldConfig) {
    return {
        ...oldConfig,
        tts: {
            providerId: null,
            model: "tts-1",
            voice: "alloy",
            speed: 1,
        },
    };
}
