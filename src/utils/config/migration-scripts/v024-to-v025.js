export function migrate(oldConfig) {
    return {
        ...oldConfig,
        translate: {
            ...oldConfig.translate,
            batchQueueConfig: {
                maxCharactersPerBatch: 1000,
                maxItemsPerBatch: 4,
            },
        },
    };
}
