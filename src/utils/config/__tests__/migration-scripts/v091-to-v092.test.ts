import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrate } from "../../migration-scripts/v091-to-v092"
import { testSeries as v091TestSeries } from "../example/v091"

describe("v091-to-v092 migration", () => {
  it("keeps Edge TTS selected and preserves existing voice settings", () => {
    const oldTts = {
      defaultVoice: "en-US-DavisNeural",
      languageVoices: { eng: "en-US-DavisNeural" },
      rate: 12,
      pitch: -3,
      volume: 5,
    }

    expect(migrate({ tts: oldTts })).toEqual({
      tts: {
        ...oldTts,
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
      },
    })
  })

  it("keeps every full v091 fixture schema-valid", () => {
    for (const { config } of Object.values(v091TestSeries)) {
      expect(configSchema.safeParse(migrate(config)).success).toBe(true)
    }
  })

  it("leaves invalid top-level values unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
  })
})
