export function migrate(oldConfig) {
    // Integrate Translation Node Style
    return {
        ...oldConfig,
        translate: {
            ...oldConfig.translate,
            translationNodeStyle: "default",
        },
    };
}
