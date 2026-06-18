export function migrate(oldConfig) {
    return {
        ...oldConfig,
        translate: {
            ...oldConfig.translate,
            page: {
                ...oldConfig.translate.page,
                autoTranslateLanguages: [],
            },
        },
    };
}
