export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    tts: {
      providerId: null,
      model: "tts-1",
      voice: "alloy",
      speed: 1,
    },
  }
}
