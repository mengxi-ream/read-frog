export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      disabledSelectionToolbarPatterns: [],
    },
  }
}
