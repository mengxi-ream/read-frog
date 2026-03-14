import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import {
  computeLanguageDetectionFallbackAfterDeletion,
  computeProviderFallbacksAfterDeletion,
  computeSelectionToolbarCustomActionFallbacksAfterDeletion,
  findFeatureMissingProvider,
  resolveLanguageDetectionConfigForModeChange,
} from "../helpers"

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

    it("skips disabled providers when selecting fallbacks", () => {
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
        {
          ...getProviderById("openai-default"),
          enabled: false,
        },
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

    it("treats disabled providers as unavailable", () => {
      const remainingProviders = [
        {
          ...getProviderById("openai-default"),
          enabled: false,
        },
      ]

      expect(findFeatureMissingProvider(remainingProviders)).toBe("translate")
    })
  })

  describe("computeSelectionToolbarCustomActionFallbacksAfterDeletion", () => {
    it("reassigns affected custom actions to the first enabled llm provider", () => {
      const config = {
        ...DEFAULT_CONFIG,
        selectionToolbar: {
          ...DEFAULT_CONFIG.selectionToolbar,
          customActions: [
            {
              id: "action-a",
              name: "Action A",
              enabled: true,
              icon: "tabler:sparkles",
              providerId: "deleted-provider",
              systemPrompt: "",
              prompt: "{{selection}}",
              outputSchema: [
                {
                  id: "field-a",
                  name: "summary",
                  type: "string" as const,
                  description: "",
                  speaking: false,
                },
              ],
            },
          ],
        },
      }

      const remainingProviders = [
        {
          ...getProviderById("openai-default"),
          enabled: false,
        },
        getProviderById("google-default"),
      ]

      const result = computeSelectionToolbarCustomActionFallbacksAfterDeletion(
        "deleted-provider",
        config,
        remainingProviders,
      )

      expect(result).toEqual([
        expect.objectContaining({
          id: "action-a",
          providerId: "google-default",
        }),
      ])
    })

    it("returns null when no enabled llm provider is available", () => {
      const config = {
        ...DEFAULT_CONFIG,
        selectionToolbar: {
          ...DEFAULT_CONFIG.selectionToolbar,
          customActions: [
            {
              id: "action-a",
              name: "Action A",
              enabled: true,
              icon: "tabler:sparkles",
              providerId: "deleted-provider",
              systemPrompt: "",
              prompt: "{{selection}}",
              outputSchema: [
                {
                  id: "field-a",
                  name: "summary",
                  type: "string" as const,
                  description: "",
                  speaking: false,
                },
              ],
            },
          ],
        },
      }

      const remainingProviders = [
        {
          ...getProviderById("openai-default"),
          enabled: false,
        },
      ]

      const result = computeSelectionToolbarCustomActionFallbacksAfterDeletion(
        "deleted-provider",
        config,
        remainingProviders,
      )

      expect(result).toBeNull()
    })
  })

  describe("resolveLanguageDetectionConfigForModeChange", () => {
    it("assigns the first enabled llm provider when switching from basic to llm", () => {
      const result = resolveLanguageDetectionConfigForModeChange(
        DEFAULT_CONFIG.languageDetection,
        "llm",
        DEFAULT_CONFIG.providersConfig,
      )

      expect(result).toEqual({
        mode: "llm",
        providerId: "openai-default",
      })
    })

    it("keeps the current provider when it is already an enabled llm provider", () => {
      const result = resolveLanguageDetectionConfigForModeChange(
        {
          mode: "basic",
          providerId: "google-default",
        },
        "llm",
        DEFAULT_CONFIG.providersConfig,
      )

      expect(result).toEqual({
        mode: "llm",
        providerId: "google-default",
      })
    })

    it("returns null when there is no enabled llm provider", () => {
      const result = resolveLanguageDetectionConfigForModeChange(
        DEFAULT_CONFIG.languageDetection,
        "llm",
        [
          {
            ...getProviderById("openai-default"),
            enabled: false,
          },
          {
            ...getProviderById("google-default"),
            enabled: false,
          },
        ],
      )

      expect(result).toBeNull()
    })
  })

  describe("computeLanguageDetectionFallbackAfterDeletion", () => {
    it("reassigns language detection to the first enabled llm provider", () => {
      const config = {
        ...DEFAULT_CONFIG,
        languageDetection: {
          mode: "llm" as const,
          providerId: "deleted-provider",
        },
      }

      const result = computeLanguageDetectionFallbackAfterDeletion(
        "deleted-provider",
        config,
        [
          {
            ...getProviderById("openai-default"),
            enabled: false,
          },
          getProviderById("google-default"),
        ],
      )

      expect(result).toBe("google-default")
    })
  })
})
