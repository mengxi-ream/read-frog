export function migrate(oldConfig) {
    return {
        ...oldConfig,
        selectionToolbar: {
            ...oldConfig.selectionToolbar,
            disabledSelectionToolbarPatterns: [],
        },
    };
}
