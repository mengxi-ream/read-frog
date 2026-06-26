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

  it("fails when a custom action uses a disabled provider", () => {
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
        customActions: DEFAULT_CONFIG.selectionToolbar.customActions.map(action => ({
          ...action,
          providerId: "openai-default",
        })),
      },
    })

    expect(issuePaths).toContain("selectionToolbar.customActions.0.providerId")
  })

  it("allows free AI for custom actions", () => {
    const result = configSchema.safeParse({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        customActions: DEFAULT_CONFIG.selectionToolbar.customActions.map(action => ({
          ...action,
          providerId: "read-frog-free-ai",
        })),
      },
    })

    expect(result.success).toBe(true)
  })

  it("rejects free AI for selection toolbar translation", () => {
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

    expect(issuePaths).toContain("selectionToolbar.features.translate.providerId")
  })

  it("rejects free AI for fixed translation features that have not enabled the capability", () => {
    const issuePaths = getIssuePaths({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        providerId: "read-frog-free-ai",
      },
    })

    expect(issuePaths).toContain("translate.providerId")
  })
})
