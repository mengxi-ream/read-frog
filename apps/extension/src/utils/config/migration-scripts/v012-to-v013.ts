export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    providersConfig: {
      ...oldConfig.providersConfig,
      deeplx: {
        apiKey: undefined,
        baseURL: 'https://api.deeplx.org/abcdefghijklmnopqrst',
      },
    },
    translate: {
      ...oldConfig.translate,
      models: {
        ...oldConfig.translate?.models,
        deeplx: null,
      },
    },
  }
}
