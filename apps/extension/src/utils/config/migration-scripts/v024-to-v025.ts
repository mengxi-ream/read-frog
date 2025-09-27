export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      requestBatchConfig: {
        batchCharacters: 1000,
        batchSize: 4,
      },
    },
  }
}
