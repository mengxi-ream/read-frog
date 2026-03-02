import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { configSchema } from "../config"

function getIssuePaths(input: unknown) {
  const result = configSchema.safeParse(input)
  if (result.success) {
    return []
  }

  return result.error.issues.map(issue => issue.path.join("."))
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

    expect(issuePaths).toContain("translate.providerId")
  })

  it("fails when a custom feature uses a disabled provider", () => {
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
        features: {
          ...DEFAULT_CONFIG.selectionToolbar.features,
          vocabularyInsight: {
            providerId: "google-default",
          },
        },
        customFeatures: DEFAULT_CONFIG.selectionToolbar.customFeatures.map(feature => ({
          ...feature,
          providerId: "openai-default",
        })),
      },
    })

    expect(issuePaths).toContain("selectionToolbar.customFeatures.0.providerId")
  })
})
