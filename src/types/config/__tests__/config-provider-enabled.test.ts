import { describe, expect, it } from "vitest"
import { createDefaultDictionaryAction, DEFAULT_CONFIG } from "@/utils/constants/config"
import { configSchema } from "../config"

function getIssuePaths(input: unknown) {
  const result = configSchema.safeParse(input)
  if (result.success) {
    return []
  }

  return result.error.issues.map((issue) => issue.path.join("."))
}

describe("config provider enabled validation", () => {
  it("fails when a built-in feature uses a disabled provider", () => {
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === "microsoft-translate-default") {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
    })

    expect(issuePaths).toContain("pageTranslation.providerId")
  })

  it("fails when a custom action uses a disabled provider", () => {
    const action = createDefaultDictionaryAction()
    if (!action) {
      throw new Error("Dictionary definition missing")
    }
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) => {
      if (provider.id === "openai-default") {
        return { ...provider, enabled: false }
      }
      return provider
    })

    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        customActions: [{ ...action, id: "custom-action", providerId: "openai-default" }],
      },
    })

    expect(issuePaths).toContain("selectionToolbar.customActions.0.providerId")
  })

  it("fails when the built-in Dictionary uses a disabled provider", () => {
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) =>
      provider.id === "openai-default" ? { ...provider, enabled: false } : provider,
    )
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        builtInActions: {
          dictionary: {
            ...DEFAULT_CONFIG.selectionToolbar.builtInActions.dictionary,
            providerId: "openai-default",
          },
        },
      },
    })

    expect(issuePaths).toContain("selectionToolbar.builtInActions.dictionary.providerId")
  })

  it("allows built-in AI for custom actions", () => {
    const action = createDefaultDictionaryAction()
    if (!action) {
      throw new Error("Dictionary definition missing")
    }
    const result = configSchema.safeParse({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        customActions: [{ ...action, id: "custom-action", providerId: "read-frog-free-ai" }],
      },
    })

    expect(result.success).toBe(true)
  })

  it("allows built-in AI for selection toolbar translation", () => {
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        features: {
          ...DEFAULT_CONFIG.selectionToolbar.features,
          translate: {
            ...DEFAULT_CONFIG.selectionToolbar.features.translate,
            providerId: "read-frog-free-ai",
          },
        },
      },
    })

    expect(issuePaths).not.toContain("selectionToolbar.features.translate.providerId")
  })

  it("rejects an unknown provider for selection toolbar translation", () => {
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        features: {
          ...DEFAULT_CONFIG.selectionToolbar.features,
          translate: {
            ...DEFAULT_CONFIG.selectionToolbar.features.translate,
            providerId: "nonexistent-provider",
          },
        },
      },
    })

    expect(issuePaths).toContain("selectionToolbar.features.translate.providerId")
  })

  it("rejects a disabled local provider for selection toolbar translation", () => {
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) =>
      provider.id === "google-translate-default" ? { ...provider, enabled: false } : provider,
    )
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      providersConfig,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        features: {
          ...DEFAULT_CONFIG.selectionToolbar.features,
          translate: {
            ...DEFAULT_CONFIG.selectionToolbar.features.translate,
            providerId: "google-translate-default",
          },
        },
      },
    })

    expect(issuePaths).toContain("selectionToolbar.features.translate.providerId")
  })

  it("allows built-in AI for page translation", () => {
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        providerId: "read-frog-free-ai",
      },
    })

    expect(issuePaths).not.toContain("pageTranslation.providerId")
  })

  it("allows built-in AI for every feature that declares the capability", () => {
    // Subtitles and input translation gained hosted routes, so the built-in
    // providers now declare those capabilities and the schema must accept them.
    for (const providerId of ["read-frog-free-ai", "read-frog-advance-ai"]) {
      expect(
        getIssuePaths({
          ...DEFAULT_CONFIG,
          inputTranslation: { ...DEFAULT_CONFIG.inputTranslation, providerId },
        }),
      ).not.toContain("inputTranslation.providerId")

      expect(
        getIssuePaths({
          ...DEFAULT_CONFIG,
          videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId },
        }),
      ).not.toContain("videoSubtitles.providerId")

      expect(
        getIssuePaths({
          ...DEFAULT_CONFIG,
          languageDetection: { mode: "llm" as const, providerId },
        }),
      ).not.toContain("languageDetection.providerId")
    }
  })

  it("still rejects a provider id no capability covers", () => {
    // The capability gate is what keeps this honest — not a hardcoded list.
    expect(
      getIssuePaths({
        ...DEFAULT_CONFIG,
        inputTranslation: { ...DEFAULT_CONFIG.inputTranslation, providerId: "does-not-exist" },
      }),
    ).toContain("inputTranslation.providerId")

    // Pure translate providers cannot run language detection: it needs an LLM.
    expect(
      getIssuePaths({
        ...DEFAULT_CONFIG,
        languageDetection: { mode: "llm" as const, providerId: "google-translate-default" },
      }),
    ).toContain("languageDetection.providerId")
  })
})
