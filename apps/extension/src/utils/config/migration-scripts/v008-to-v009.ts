export function migrate(oldConfig: any): any {
  // Expose request queue rate parameters
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      requestQueueConfig: {
        capacity: 300,
        rate: 5,
      },
    },

  }
}
