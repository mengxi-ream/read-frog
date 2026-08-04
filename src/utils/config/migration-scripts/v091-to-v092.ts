/**
 * Migration script from v091 to v092
 * - Adds a selectable TTS backend.
 * - Keeps existing users on Edge TTS.
 * - Seeds OpenAI-compatible settings without changing existing Edge voice preferences.
 *
 * IMPORTANT: Migration scripts are frozen snapshots. Keep defaults inline and do not
 * import runtime constants or shared types.
 */
export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  const oldTts =
    oldConfig.tts && typeof oldConfig.tts === "object" && !Array.isArray(oldConfig.tts)
      ? oldConfig.tts
      : {}

  return {
    ...oldConfig,
    tts: {
      backend: "edge",
      openAICompatible: {
        baseURL: "http://127.0.0.1:8880/v1",
        apiKey: "",
        model: "kokoro",
        voice: "af_heart",
        responseFormat: "mp3",
        speed: 1,
        instructions: "",
      },
      ...oldTts,
    },
  }
}
