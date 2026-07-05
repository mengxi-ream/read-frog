import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v083-to-v084"

const DEFAULT_SUBTITLE_TTS_CONFIG = {
  enabled: false,
  readTarget: "translation",
  voiceMode: "auto",
  customVoice: "",
  rate: 0,
  pauseWithVideo: true,
}

describe("v083-to-v084 migration", () => {
  it("adds default tts config to videoSubtitles", () => {
    const oldConfig = {
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "openai-default",
      },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.videoSubtitles.tts).toEqual(DEFAULT_SUBTITLE_TTS_CONFIG)
    // Preserves existing fields
    expect(migrated.videoSubtitles.providerId).toBe("openai-default")
  })

  it("does not overwrite an existing tts config", () => {
    const oldConfig = {
      videoSubtitles: {
        enabled: true,
        tts: { enabled: true, readTarget: "original", voiceMode: "custom", customVoice: "en-US-AvaNeural", rate: 10, pauseWithVideo: false },
      },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.videoSubtitles.tts).toEqual({
      enabled: true,
      readTarget: "original",
      voiceMode: "custom",
      customVoice: "en-US-AvaNeural",
      rate: 10,
      pauseWithVideo: false,
    })
  })

  it("leaves config without videoSubtitles unchanged", () => {
    const oldConfig = { translate: { providerId: "x" } }

    const migrated = migrate(oldConfig)

    expect(migrated).toBe(oldConfig)
  })

  it("handles null/undefined/non-object input", () => {
    expect(migrate(null)).toBe(null)
    expect(migrate(undefined)).toBe(undefined)
    expect(migrate("config")).toBe("config")
  })
})
