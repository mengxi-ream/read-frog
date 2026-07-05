/**
 * Migration script from v083 to v084
 * - Adds 'tts' object to videoSubtitles config for read-aloud translated/original subtitles.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const DEFAULT_SUBTITLE_TTS_CONFIG = {
  enabled: false,
  readTarget: "translation",
  voiceMode: "auto",
  customVoice: "",
  rate: 0,
  pauseWithVideo: true,
} as const

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  if (!oldConfig.videoSubtitles || typeof oldConfig.videoSubtitles !== "object") {
    return oldConfig
  }

  // Don't overwrite if a future/migrated config already has tts.
  if (oldConfig.videoSubtitles.tts !== undefined) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      tts: { ...DEFAULT_SUBTITLE_TTS_CONFIG },
    },
  }
}
