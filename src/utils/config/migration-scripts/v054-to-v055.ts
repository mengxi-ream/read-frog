/**
 * Migration script from v054 to v055
 * Adds tts.detectLanguageMode with default "basic"
 */
export function migrate(oldConfig: any): any {
  const detectLanguageMode = 'basic'

  return {
    ...oldConfig,
    tts: {
      ...oldConfig.tts,
      detectLanguageMode,
    },
  }
}
