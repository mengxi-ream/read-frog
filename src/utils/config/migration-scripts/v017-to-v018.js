export function migrate(oldConfig) {
    return {
        ...oldConfig,
        translate: {
            ...oldConfig.translate,
            customAutoTranslateShortcutKey: ["alt", "q"],
        },
    };
}
