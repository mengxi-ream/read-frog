import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import {
  computeTTSFallbackAfterDeletion,
  findFeatureMissingProvider,
  isGeminiTTSProviderAssigned,
  resolveTTSConfigForProviderChange,
} from "../helpers"

function googleProvider(id: string, enabled = true): ProviderConfig {
  return { ...DEFAULT_PROVIDER_CONFIG.google, id, name: id, enabled, apiKey: "key" }
}

function configWithTTS(
  tts: { provider: "edge-tts" | "gemini"; providerId: string | null },
  providers: ProviderConfig[],
): Config {
  return {
    ...DEFAULT_CONFIG,
    providersConfig: [...DEFAULT_CONFIG.providersConfig, ...providers],
    tts: {
      ...DEFAULT_CONFIG.tts,
      provider: tts.provider,
      gemini: { ...DEFAULT_CONFIG.tts.gemini, providerId: tts.providerId },
    },
  }
}

describe("Gemini TTS provider", () => {
  describe("isGeminiTTSProviderAssigned", () => {
    it("counts the provider only while Gemini reads aloud", () => {
      const providers = [googleProvider("google-a")]
      expect(
        isGeminiTTSProviderAssigned(
          configWithTTS({ provider: "gemini", providerId: "google-a" }, providers),
          "google-a",
        ),
      ).toBe(true)
      expect(
        isGeminiTTSProviderAssigned(
          configWithTTS({ provider: "edge-tts", providerId: "google-a" }, providers),
          "google-a",
        ),
      ).toBe(false)
    })
  })

  describe("resolveTTSConfigForProviderChange", () => {
    it("keeps the Google provider already chosen when switching to Gemini", () => {
      const providers = [googleProvider("google-a"), googleProvider("google-b")]
      const { tts } = configWithTTS({ provider: "edge-tts", providerId: "google-b" }, providers)

      expect(resolveTTSConfigForProviderChange(tts, "gemini", providers)).toEqual({
        provider: "gemini",
        gemini: { ...tts.gemini, providerId: "google-b" },
      })
    })

    it("takes the first enabled Google provider when the chosen one cannot be used", () => {
      const providers = [googleProvider("google-off", false), googleProvider("google-a")]
      const { tts } = configWithTTS({ provider: "edge-tts", providerId: "google-off" }, providers)

      expect(resolveTTSConfigForProviderChange(tts, "gemini", providers)?.gemini?.providerId).toBe(
        "google-a",
      )
    })

    it("refuses Gemini when no Google provider can lend it a key", () => {
      const providers = [googleProvider("google-off", false)]
      const { tts } = configWithTTS({ provider: "edge-tts", providerId: null }, providers)

      expect(resolveTTSConfigForProviderChange(tts, "gemini", providers)).toBeNull()
    })

    it("switches back to Edge TTS without touching the Gemini settings", () => {
      const providers = [googleProvider("google-a")]
      const { tts } = configWithTTS({ provider: "gemini", providerId: "google-a" }, providers)

      expect(resolveTTSConfigForProviderChange(tts, "edge-tts", providers)).toEqual({
        provider: "edge-tts",
      })
    })
  })

  describe("computeTTSFallbackAfterDeletion", () => {
    it("needs no change when another provider is deleted", () => {
      const config = configWithTTS({ provider: "gemini", providerId: "google-a" }, [
        googleProvider("google-a"),
      ])
      expect(computeTTSFallbackAfterDeletion("openai-default", config, [])).toBeNull()
    })

    it("moves to the next enabled Google provider", () => {
      const config = configWithTTS({ provider: "gemini", providerId: "google-a" }, [])
      const remaining = [googleProvider("google-off", false), googleProvider("google-b")]
      expect(computeTTSFallbackAfterDeletion("google-a", config, remaining)).toBe("google-b")
    })

    it("has nothing to move to once the last Google provider goes", () => {
      const config = configWithTTS({ provider: "edge-tts", providerId: "google-a" }, [])
      expect(computeTTSFallbackAfterDeletion("google-a", config, [])).toBeUndefined()
    })
  })

  describe("findFeatureMissingProvider", () => {
    it("blocks deleting the last Google provider while Gemini reads aloud", () => {
      const config = configWithTTS({ provider: "gemini", providerId: "google-a" }, [
        googleProvider("google-a"),
      ])
      expect(findFeatureMissingProvider(DEFAULT_CONFIG.providersConfig, config)).toBe("tts")
    })

    it("lets it go while Edge TTS reads aloud", () => {
      const config = configWithTTS({ provider: "edge-tts", providerId: "google-a" }, [
        googleProvider("google-a"),
      ])
      expect(findFeatureMissingProvider(DEFAULT_CONFIG.providersConfig, config)).toBeNull()
    })
  })

  describe("config schema", () => {
    it("accepts Gemini with an enabled Google provider", () => {
      const config = configWithTTS({ provider: "gemini", providerId: "google-a" }, [
        googleProvider("google-a"),
      ])
      expect(configSchema.safeParse(config).success).toBe(true)
    })

    it.each([
      ["no provider", null, [googleProvider("google-a")]],
      ["a disabled provider", "google-a", [googleProvider("google-a", false)]],
      ["a missing provider", "google-gone", [googleProvider("google-a")]],
      ["a provider that is not Google", "openai-default", []],
    ])("rejects Gemini with %s", (_label, providerId, providers) => {
      const config = configWithTTS({ provider: "gemini", providerId }, providers)
      const result = configSchema.safeParse(config)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(["tts", "gemini", "providerId"])
    })

    it("does not judge the stored provider while Edge TTS reads aloud", () => {
      const config = configWithTTS({ provider: "edge-tts", providerId: "google-gone" }, [])
      expect(configSchema.safeParse(config).success).toBe(true)
    })
  })
})
