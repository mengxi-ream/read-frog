export function migrate(oldConfig) {
    const { customAutoTranslateShortcutKey, ...restTranslate } = oldConfig.translate;
    return {
        ...oldConfig,
        translate: {
            ...restTranslate,
            page: {
                ...oldConfig.translate.page,
                shortcut: customAutoTranslateShortcutKey,
            },
        },
    };
}
