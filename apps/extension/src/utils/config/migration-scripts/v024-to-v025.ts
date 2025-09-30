export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      batchQueueConfig: {
        maxCharactersPerBatch: 1000,
        maxItemsPerBatch: 4,
      },
    },
  }
}
