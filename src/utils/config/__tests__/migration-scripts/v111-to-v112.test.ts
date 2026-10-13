import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v111-to-v112"
import { testSeries as v111TestSeries } from "../example/v111"

function v111Tts() {
  const { provider: _provider, gemini: _gemini, ...tts } = DEFAULT_CONFIG.tts
  return tts
}

const GOOGLE_PROVIDERS = [
  { id: "openai-default", provider: "openai", enabled: true },
  { id: "google-off", provider: "google", enabled: false },
  { id: "google-on", provider: "google", enabled: true },
]

describe("v111-to-v112 migration", () => {
  it("keeps Edge TTS as the provider and adds the Gemini defaults", () => {
    const migrated = migrate({ tts: v111Tts(), providersConfig: [] })

    expect(migrated.tts).toEqual({
      ...v111Tts(),
      provider: "edge-tts",
      gemini: { providerId: null, model: "gemini-3.8-flash-lite-tts", voice: "kore", style: "" },
    })
  })

  it("preselects the first enabled Google provider", () => {
    const migrated = migrate({ tts: v111Tts(), providersConfig: GOOGLE_PROVIDERS })

    expect(migrated.tts.gemini.providerId).toBe("google-on")
  })

  it("produces a config the v112 schema accepts", () => {
    const config = { ...structuredClone(DEFAULT_CONFIG), tts: v111Tts() }
    expect(configSchema.safeParse(migrate(config)).success).toBe(true)
  })

  it("returns the config by identity once the fields are there", () => {
    const once = migrate({ tts: v111Tts(), providersConfig: GOOGLE_PROVIDERS })
    expect(migrate(once)).toBe(once)
  })

  it("keeps a Gemini choice saved before the migration ran", () => {
    // A UI context that loaded ahead of the migration can store v112 fields under v111.
    const config = {
      tts: {
        ...v111Tts(),
        provider: "gemini",
        gemini: {
          providerId: "google-off",
          model: "gemini-2.5-pro-preview-tts",
          voice: "puck",
          style: "calm",
        },
      },
      providersConfig: GOOGLE_PROVIDERS,
    }
    expect(migrate(config)).toBe(config)
  })

  it("preselects a Google provider for the schema default a UI context wrote back", () => {
    const config = {
      tts: {
        ...v111Tts(),
        provider: "edge-tts",
        gemini: { providerId: null, model: "gemini-3.8-flash-tts", voice: "puck", style: "calm" },
      },
      providersConfig: GOOGLE_PROVIDERS,
    }

    expect(migrate(config).tts.gemini).toEqual({
      providerId: "google-on",
      model: "gemini-3.8-flash-tts",
      voice: "puck",
      style: "calm",
    })
  })

  it("leaves a config without tts alone", () => {
    const config = { language: {} }
    expect(migrate(config)).toBe(config)
  })
})

describe("v112 schema upgrade window", () => {
  it("still parses a v111 config before the background has migrated it", () => {
    // Otherwise a UI context reads DEFAULT_CONFIG and its next write saves that over the user's.
    for (const { config } of Object.values(v111TestSeries)) {
      const result = configSchema.safeParse(config)
      expect(result.success).toBe(true)
      expect(result.data?.tts.provider).toBe("edge-tts")
    }
  })
})
