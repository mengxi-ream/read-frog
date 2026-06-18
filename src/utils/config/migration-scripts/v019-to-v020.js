export function migrate(oldConfig) {
    return {
        ...oldConfig,
        floatingButton: {
            ...oldConfig.floatingButton,
            disabledFloatingButtonPatterns: [],
        },
    };
}
