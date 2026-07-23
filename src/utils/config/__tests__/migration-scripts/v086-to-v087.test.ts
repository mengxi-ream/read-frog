import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v086-to-v087"

describe("v086-to-v087 migration", () => {
  it("drops the stale thinkingBudget recommendation from Google providers", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "google-default",
          provider: "google",
          reasoning: "none",
          providerOptions: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerOptions).toBeUndefined()
    expect(migrated.providersConfig[0].reasoning).toBe("none")
  })

  it("drops the stale thinkingLevel recommendation and defaults reasoning to none", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "google-default",
          provider: "google",
          providerOptions: { thinkingConfig: { thinkingLevel: "minimal", includeThoughts: false } },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerOptions).toBeUndefined()
    expect(migrated.providersConfig[0].reasoning).toBe("none")
  })

  it("keeps hand-written Google provider options and existing reasoning", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "google-custom",
          provider: "google",
          reasoning: "low",
          providerOptions: { thinkingConfig: { thinkingBudget: 8192, includeThoughts: false } },
        },
        {
          id: "google-extra-keys",
          provider: "google",
          providerOptions: {
            thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
            safetySettings: [],
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerOptions).toEqual({
      thinkingConfig: { thinkingBudget: 8192, includeThoughts: false },
    })
    expect(migrated.providersConfig[0].reasoning).toBe("low")
    expect(migrated.providersConfig[1].providerOptions).toEqual({
      thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
      safetySettings: [],
    })
    expect(migrated.providersConfig[1].reasoning).toBeUndefined()
  })

  it("leaves non-Google providers untouched", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openai-default",
          provider: "openai",
          providerOptions: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerOptions).toEqual({
      thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
    })
  })

  it("is idempotent", () => {
    const once = migrate({
      providersConfig: [
        {
          id: "google-default",
          provider: "google",
          providerOptions: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } },
        },
      ],
    })
    const twice = migrate(once)

    expect(twice).toEqual(once)
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
    expect(migrate({ uiLanguage: "ja" })).toEqual({ uiLanguage: "ja" })
  })
})
