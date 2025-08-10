export function migrate(oldConfig: any): any {
  // Integrate Translation Node Style
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      translationNodeStyle: 'default',
    },
  }
}
