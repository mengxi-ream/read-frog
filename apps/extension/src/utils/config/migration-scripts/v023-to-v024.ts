export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    betaExperience: {
      enabled: false,
    },
  }
}
