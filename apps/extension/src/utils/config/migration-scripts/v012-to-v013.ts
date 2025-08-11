export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    providersConfig: {
      ...oldConfig.providersConfig,
      deeplx: {
        apiKey: undefined,
        baseURL: 'https://deeplx.vercel.app',
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
