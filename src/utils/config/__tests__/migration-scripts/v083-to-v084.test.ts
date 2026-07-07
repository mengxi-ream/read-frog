import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v083-to-v084"

describe("v083-to-v084 migration", () => {
  it("adds uiLanguage defaulting to 'auto'", () => {
    const migrated = migrate({ providersConfig: [] })
    expect(migrated.uiLanguage).toBe("auto")
  })

  it("preserves an already-set uiLanguage (idempotent)", () => {
    const migrated = migrate({ uiLanguage: "ja", providersConfig: [] })
    expect(migrated.uiLanguage).toBe("ja")
  })

  it("strips resolved description strings baked into providersConfig entries", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openai-default",
          provider: "openai",
          name: "OpenAI",
          description: "Access GPT models via the OpenAI API",
          enabled: true,
        },
        {
          id: "google-translate-default",
          provider: "google-translate",
          name: "Google Translate",
          enabled: true,
        },
      ],
    })

    expect("description" in migrated.providersConfig[0]).toBe(false)
    expect(migrated.providersConfig[0]).toEqual({
      id: "openai-default",
      provider: "openai",
      name: "OpenAI",
      enabled: true,
    })
    // A provider that never had a description is left untouched.
    expect(migrated.providersConfig[1]).toEqual({
      id: "google-translate-default",
      provider: "google-translate",
      name: "Google Translate",
      enabled: true,
    })
  })

  it("does not touch nested outputSchema field descriptions inside customActions", () => {
    const migrated = migrate({
      providersConfig: [],
      selectionToolbar: {
        customActions: [
          {
            id: "default-dictionary",
            outputSchema: [{ id: "term", name: "Term", type: "string", description: "" }],
          },
        ],
      },
    })

    expect(migrated.selectionToolbar.customActions[0].outputSchema[0].description).toBe("")
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
  })
})
