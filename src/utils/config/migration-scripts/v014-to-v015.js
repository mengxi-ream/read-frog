export function migrate(oldConfig) {
    return {
        ...oldConfig,
        selectionToolbar: {
            enabled: true,
        },
    };
}
