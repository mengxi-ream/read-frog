import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v095-to-v096"

function configWith() {
  return {
    providersConfig: [
      {
        id: "microsoft-translate-default",
        enabled: true,
        name: "Microsoft Translator",
        provider: "microsoft-translate",
      },
      {
        id: "openai-default",
        enabled: true,
        name: "OpenAI",
        provider: "openai",
      },
      {
        id: "deepseek-disabled",
        enabled: false,
        name: "DeepSeek",
        provider: "deepseek",
      },
    ],
    selectionToolbar: {
      features: {
        translate: { enabled: true, providerId: "openai-default", shortcut: "Alt+T" },
      },
      // The v095 shape: the section still lives under the old key and has no
      // provider of its own.
      saveSuggestion: {
        enabled: true,
        actionId: "default-dictionary",
      },
    },
    language: { targetCode: "cmn" },
  }
}

function configWithTranslateProvider(providerId: string) {
  const config = configWith()
  config.selectionToolbar.features.translate.providerId = providerId
  return config
}

describe("v095 to v096 migration", () => {
  it("renames the section and copies the enabled LLM selection-translate provider", () => {
    const result = migrate(configWith())

    expect(result.selectionToolbar.noteSuggestion).toEqual({
      enabled: true,
      actionId: "default-dictionary",
      providerId: "openai-default",
    })
    // The old key is gone, not merely duplicated.
    expect("saveSuggestion" in result.selectionToolbar).toBe(false)
  })

  it("falls back to the built-in AI provider when the translate provider is not an LLM", () => {
    const result = migrate(configWithTranslateProvider("microsoft-translate-default"))

    expect(result.selectionToolbar.noteSuggestion.providerId).toBe("read-frog-ultra-ai")
  })

  it("falls back to the built-in AI provider when the translate LLM provider is disabled", () => {
    const result = migrate(configWithTranslateProvider("deepseek-disabled"))

    expect(result.selectionToolbar.noteSuggestion.providerId).toBe("read-frog-ultra-ai")
  })

  it("falls back to the built-in AI provider when the translate provider id is unknown", () => {
    const result = migrate(configWithTranslateProvider("missing-provider"))

    expect(result.selectionToolbar.noteSuggestion.providerId).toBe("read-frog-ultra-ai")
  })

  it("leaves the rest of the config untouched and does not mutate the input", () => {
    const oldConfig = configWith()
    const snapshot = structuredClone(oldConfig)
    const { saveSuggestion, ...selectionToolbarRest } = snapshot.selectionToolbar

    const result = migrate(oldConfig)

    expect(result).toEqual({
      ...snapshot,
      selectionToolbar: {
        ...selectionToolbarRest,
        noteSuggestion: {
          ...saveSuggestion,
          providerId: "openai-default",
        },
      },
    })
    expect(oldConfig).toEqual(snapshot)
  })

  it("returns the config by reference when the section is already renamed and funded", () => {
    const oldConfig = {
      ...configWith(),
      selectionToolbar: {
        features: {
          translate: { enabled: true, providerId: "openai-default", shortcut: "Alt+T" },
        },
        noteSuggestion: {
          enabled: true,
          actionId: "default-dictionary",
          providerId: "read-frog-ultra-ai",
        },
      },
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("is idempotent", () => {
    const once = migrate(configWith())
    const twice = migrate(once)

    expect(twice).toBe(once)
  })

  it.each([
    ["null", null],
    ["a non-object", "config"],
    ["an array", []],
    ["a config without a selectionToolbar section", { language: { targetCode: "cmn" } }],
    [
      "a config whose selectionToolbar has neither suggestion section",
      { selectionToolbar: { features: { translate: { providerId: "openai-default" } } } },
    ],
  ])("returns %s unchanged", (_label, oldConfig) => {
    expect(migrate(oldConfig)).toBe(oldConfig)
  })
})
