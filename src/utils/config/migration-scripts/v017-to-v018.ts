export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      customAutoTranslateShortcutKey: ["alt", "q"],
    },
  }
}
