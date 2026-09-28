import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v103-to-v104"

/** A stored v103 custom action with the given output field ids. Typed `any`
 * like the migration it feeds — this is a stored shape, not the schema. */
function storedAction(id: string, fieldIds: string[]): any {
  return {
    id,
    name: `Action ${id}`,
    enabled: true,
    icon: "tabler:sparkles",
    providerId: "openai-default",
    systemPrompt: "",
    prompt: "{{selection}}",
    outputSchema: fieldIds.map((fieldId) => ({
      id: fieldId,
      name: `Field ${fieldId}`,
      type: "string",
      description: "",
    })),
    layout: "",
  }
}

function storedConfig(
  dictionary: any = { enabled: true, providerId: "deepseek-default" },
  customActions: any[] = [],
): any {
  return {
    uiLanguage: "zh-CN",
    selectionToolbar: {
      enabled: true,
      opacity: 100,
      builtInActions: { dictionary },
      customActions,
      noteSuggestion: { enabled: true, actionId: "default-dictionary", providerId: "openai" },
    },
  }
}

describe("v103 -> v104 migration", () => {
  it("adds the built-in Sentence Analysis, enabled, on the Dictionary's provider", () => {
    const old = storedConfig()
    const migrated = migrate(old)

    expect(migrated.selectionToolbar.builtInActions).toEqual({
      dictionary: { enabled: true, providerId: "deepseek-default" },
      sentenceAnalysis: { enabled: true, providerId: "deepseek-default" },
    })
    // Everything else is carried over untouched.
    expect(migrated.uiLanguage).toBe("zh-CN")
    expect(migrated.selectionToolbar.noteSuggestion).toBe(old.selectionToolbar.noteSuggestion)
    expect(migrated.selectionToolbar.builtInActions.dictionary).toBe(
      old.selectionToolbar.builtInActions.dictionary,
    )
    expect(old.selectionToolbar.builtInActions).not.toHaveProperty("sentenceAnalysis")
  })

  it("is enabled whether or not the Dictionary is", () => {
    const migrated = migrate(storedConfig({ enabled: false, providerId: "read-frog-free-ai" }))
    expect(migrated.selectionToolbar.builtInActions.sentenceAnalysis).toEqual({
      enabled: true,
      providerId: "read-frog-free-ai",
    })
  })

  it.each([
    ["no Dictionary state", undefined],
    ["a Dictionary without a provider", { enabled: true }],
    ["a blank provider", { enabled: true, providerId: "" }],
    ["a non-string provider", { enabled: true, providerId: 7 }],
  ])("falls back to the Built-in AI with %s", (_case, dictionary) => {
    const old = storedConfig(dictionary)
    if (dictionary === undefined) delete old.selectionToolbar.builtInActions.dictionary
    expect(migrate(old).selectionToolbar.builtInActions.sentenceAnalysis).toEqual({
      enabled: true,
      providerId: "read-frog-free-ai",
    })
  })

  it.each([
    ["made from the preset", "sentence-analysis-annotations"],
    ["copied from a copy", "default-sentence-analysis-annotations"],
  ])("starts disabled next to a Sentence Analysis action %s", (_case, fieldId) => {
    const migrated = migrate(
      storedConfig(undefined, [
        storedAction("other", ["x"]),
        storedAction("mine", [fieldId, "sentence-analysis-translation"]),
      ]),
    )
    expect(migrated.selectionToolbar.builtInActions.sentenceAnalysis).toEqual({
      enabled: false,
      providerId: "deepseek-default",
    })
  })

  it("does not take near misses for a Sentence Analysis action", () => {
    const migrated = migrate(
      storedConfig(undefined, [
        storedAction("a", ["sentence-analysis-annotations-2", "xsentence-analysis-annotations"]),
        storedAction("b", ["sentence-analysis-translation"]),
        { id: "broken", outputSchema: "sentence-analysis-annotations" },
        null,
      ]),
    )
    expect(migrated.selectionToolbar.builtInActions.sentenceAnalysis.enabled).toBe(true)
  })

  it("returns the config by identity once the state exists", () => {
    const once = migrate(storedConfig())
    expect(migrate(once)).toBe(once)

    // A state a UI context wrote first is kept as it is.
    const written = storedConfig()
    written.selectionToolbar.builtInActions.sentenceAnalysis = {
      enabled: false,
      providerId: "openai-default",
    }
    expect(migrate(written)).toBe(written)
  })

  it.each([
    ["null", null],
    ["an array", []],
    ["no selection toolbar", { uiLanguage: "en" }],
    ["no builtInActions", { selectionToolbar: { customActions: [] } }],
    ["a non-object builtInActions", { selectionToolbar: { builtInActions: [] } }],
  ])("leaves %s for the schema to report", (_case, config) => {
    expect(migrate(config)).toBe(config)
  })
})
