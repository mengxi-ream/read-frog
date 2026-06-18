export function migrate(oldConfig) {
    return {
        ...oldConfig,
        betaExperience: {
            enabled: false,
        },
    };
}
