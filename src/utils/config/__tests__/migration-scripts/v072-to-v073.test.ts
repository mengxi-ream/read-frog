import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v072-to-v073"

describe("v072-to-v073 migration", () => {
  it("adds selectionTranslation config section", () => {
    const migrated = migrate({
      translate: {
        providerId: "openai-default",
      },
      providersConfig: [
        {
          id: "openai-default",
          enabled: true,
          provider: "openai",
        },
      ],
    })

    expect(migrated.selectionTranslation).toEqual({
      enabled: true,
      triggerMode: "toolbar",
      providerId: "openai-default",
      autoPronunciation: false,
      disabledSites: [],
    })
  })

  it("prefers google-translate-default when available", () => {
    const migrated = migrate({
      translate: {
        providerId: "openai-default",
      },
      providersConfig: [
        {
          id: "openai-default",
          enabled: true,
          provider: "openai",
        },
        {
          id: "google-translate-default",
          enabled: true,
          provider: "google-translate",
        },
      ],
    })

    expect(migrated.selectionTranslation.providerId).toBe("google-translate-default")
  })

  it("falls back to existing translate.providerId when no non-API translate provider exists", () => {
    const migrated = migrate({
      translate: {
        providerId: "google-default",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          provider: "google",
        },
      ],
    })

    expect(migrated.selectionTranslation.providerId).toBe("google-default")
  })

  it("preserves existing config keys", () => {
    const migrated = migrate({
      language: {
        sourceCode: "eng",
        targetCode: "cmn",
      },
    })

    expect(migrated.language).toEqual({
      sourceCode: "eng",
      targetCode: "cmn",
    })
  })
})
