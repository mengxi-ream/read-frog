export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    read: {
      ...oldConfig.read,
      models: {
        ...oldConfig.read.models,
        gemini: {
          model: 'gemini-2.5-pro',
          isCustomModel: false,
          customModel: '',
        },
      },
    },
  }
}
