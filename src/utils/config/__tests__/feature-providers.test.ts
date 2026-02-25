import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { computeProviderFallbacksAfterDeletion, findFeatureMissingProvider } from "../helpers"

function getProviderById(id: string): ProviderConfig {
  const provider = DEFAULT_CONFIG.providersConfig.find(item => item.id === id)
  if (!provider)
    throw new Error(`Provider "${id}" not found in DEFAULT_CONFIG.providersConfig`)
  return provider
}

describe("feature providers", () => {
  describe("buildFeatureProviderPatch", () => {
    it("builds patch for a single feature assignment", () => {
      const patch = buildFeatureProviderPatch({
        translate: "openai-default",
      })

      expect(patch).toEqual({
        translate: {
          providerId: "openai-default",
        },
      })
    })

    it("builds patch for multiple feature assignments", () => {
      const patch = buildFeatureProviderPatch({
        "translate": "microsoft-translate-default",
        "selectionToolbar.vocabularyInsight": "openai-default",
      })

      expect(patch).toEqual({
        translate: {
          providerId: "microsoft-translate-default",
        },
        selectionToolbar: {
          features: {
            vocabularyInsight: {
              providerId: "openai-default",
            },
          },
        },
      })
    })
  })

  describe("computeProviderFallbacksAfterDeletion", () => {
    it("returns fallback assignments for every affected feature when candidates exist", () => {
      const config = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          providerId: "deleted-provider",
        },
        videoSubtitles: {
          ...DEFAULT_CONFIG.videoSubtitles,
          providerId: "deleted-provider",
        },
        selectionToolbar: {
          ...DEFAULT_CONFIG.selectionToolbar,
          features: {
            ...DEFAULT_CONFIG.selectionToolbar.features,
            translate: { providerId: "deleted-provider" },
            vocabularyInsight: { providerId: "deleted-provider" },
          },
        },
        inputTranslation: {
          ...DEFAULT_CONFIG.inputTranslation,
          providerId: "deleted-provider",
        },
      }

      const remainingProviders = [
        getProviderById("microsoft-translate-default"),
        getProviderById("openai-default"),
      ]

      const fallbacks = computeProviderFallbacksAfterDeletion("deleted-provider", config, remainingProviders)

      expect(fallbacks).toEqual({
        "translate": "microsoft-translate-default",
        "videoSubtitles": "microsoft-translate-default",
        "selectionToolbar.translate": "microsoft-translate-default",
        "selectionToolbar.vocabularyInsight": "openai-default",
        "inputTranslation": "microsoft-translate-default",
      })
    })

    it("skips features that have no compatible remaining provider", () => {
      const config = {
        ...DEFAULT_CONFIG,
        selectionToolbar: {
          ...DEFAULT_CONFIG.selectionToolbar,
          features: {
            ...DEFAULT_CONFIG.selectionToolbar.features,
            vocabularyInsight: { providerId: "deleted-provider" },
          },
        },
      }

      const remainingProviders = [
        getProviderById("microsoft-translate-default"),
      ]

      const fallbacks = computeProviderFallbacksAfterDeletion("deleted-provider", config, remainingProviders)

      expect(fallbacks["selectionToolbar.vocabularyInsight"]).toBeUndefined()
    })
  })

  describe("findFeatureMissingProvider", () => {
    it("returns the first missing feature key when providers are insufficient", () => {
      const remainingProviders = [
        getProviderById("microsoft-translate-default"),
      ]

      expect(findFeatureMissingProvider(remainingProviders)).toBe("selectionToolbar.vocabularyInsight")
    })

    it("returns null when all features have at least one compatible provider", () => {
      const remainingProviders = [
        getProviderById("openai-default"),
      ]

      expect(findFeatureMissingProvider(remainingProviders)).toBeNull()
    })
  })
})
