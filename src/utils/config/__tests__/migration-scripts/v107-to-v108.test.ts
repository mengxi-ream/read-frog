import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v107-to-v108"

/** A stored v107 output field. Typed `any` like the migration it feeds. */
function storedField(id: string, name: string, type = "string"): any {
  return { id, name, type, description: "" }
}

/** A stored v107 custom action: no `sampleData`. */
function storedAction(id: string, outputSchema: any[], overrides: Record<string, any> = {}): any {
  return {
    id,
    name: `Action ${id}`,
    enabled: true,
    icon: "tabler:sparkles",
    providerId: "openai-default",
    systemPrompt: "",
    prompt: "{{selection}}",
    outputSchema,
    layout: "",
    ...overrides,
  }
}

function storedConfig(
  customActions: any,
  { targetCode = "cmn", uiLanguage = "auto" }: { targetCode?: string; uiLanguage?: string } = {},
): any {
  return {
    language: { sourceCode: "auto", targetCode, level: "intermediate" },
    uiLanguage,
    selectionToolbar: {
      enabled: true,
      customActions,
      builtInActions: {
        dictionary: { enabled: true, providerId: "read-frog-free-ai" },
      },
    },
  }
}

function sampleDataOf(outputSchema: any[], options?: Parameters<typeof storedConfig>[1]): any {
  const migrated = migrate(storedConfig([storedAction("a", outputSchema)], options))
  return migrated.selectionToolbar.customActions[0].sampleData
}

const dictionaryFields = (prefix: string) => [
  storedField(`${prefix}dictionary-term`, "Term"),
  storedField(`${prefix}dictionary-phonetic`, "Phonetic"),
  storedField(`${prefix}dictionary-definition`, "Definition"),
  storedField(`${prefix}dictionary-context`, "Context"),
  storedField(`${prefix}dictionary-context-term`, "Context term"),
  storedField(`${prefix}dictionary-context-translation`, "Context translation"),
]

describe("v107-to-v108 migration", () => {
  it("gives a plain action its field names, a number field 3 and the dictionary selection", () => {
    expect(
      sampleDataOf([storedField("a", "Summary"), storedField("b", "Score", "number")]),
    ).toEqual({
      selection: "blossoms",
      targetCode: "cmn",
      values: { a: "Summary", b: "3" },
    })
  })

  it("fills a dictionary card's slots with the curated sample in the reader's language", () => {
    for (const prefix of ["", "default-"]) {
      const sample = sampleDataOf([...dictionaryFields(prefix), storedField("extra", "Extra")])
      expect(sample.selection).toBe("blossoms")
      expect(sample.targetCode).toBe("cmn")
      expect(sample.values).toEqual({
        [`${prefix}dictionary-term`]: "blossom",
        [`${prefix}dictionary-phonetic`]: "/ˈblɒs.əm/",
        [`${prefix}dictionary-definition`]: "花；花朵（尤指果树的花）",
        [`${prefix}dictionary-context`]:
          "The ephemeral beauty of cherry blossoms reminds us to cherish each moment.",
        [`${prefix}dictionary-context-term`]: '[{"text":"blossoms"}]',
        [`${prefix}dictionary-context-translation`]: "樱花短暂的美丽提醒我们珍惜每一刻。",
        extra: "Extra",
      })
    }
  })

  it("gives a sentence-analysis-shaped action the sentence and its analysis", () => {
    const sample = sampleDataOf(
      [
        storedField("sentence-analysis-annotations", "Annotations"),
        storedField("sentence-analysis-translation", "Translation"),
        ...dictionaryFields(""),
      ],
      { targetCode: "eng" },
    )
    expect(sample.selection).toBe(
      "虽然这个方案成本很高，但大多数专家认为它是解决城市交通拥堵的唯一办法。",
    )
    expect(sample.targetCode).toBe("eng")
    expect(sample.values["sentence-analysis-translation"]).toBe(
      "Although this plan is very costly, most experts believe it is the only way to solve urban traffic congestion.",
    )
    const annotations = JSON.parse(sample.values["sentence-analysis-annotations"])
    expect(annotations[0]).toEqual({
      text: "虽然这个方案成本很高",
      type: "adverbial",
      form: "clause",
      sense: "concession",
    })
    // Its dictionary fields keep the dictionary sample, in English for English.
    expect(sample.values["dictionary-term"]).toBe("珍惜")
  })

  it("gives an Improve-Writing-shaped action the email and its marks", () => {
    const sample = sampleDataOf(
      [
        storedField("default-improve-writing-setting", "Setting"),
        storedField("default-improve-writing-annotations", "Annotations"),
        storedField("default-improve-writing-improved", "Improved"),
        storedField("default-improve-writing-summary", "Summary"),
      ],
      { targetCode: "jpn" },
    )
    expect(sample.selection).toMatch(/^Dear Professor Lee, I want to know/)
    expect(sample.targetCode).toBe("jpn")
    expect(sample.values["default-improve-writing-setting"]).toBe("フォーマル · 教授へのメール")
    expect(JSON.parse(sample.values["default-improve-writing-annotations"])).toHaveLength(3)
    expect(sample.values["default-improve-writing-summary"]).toBe(
      "呼びかけは適切だが、依頼の口調が教授には少し直接的すぎる。",
    )
  })

  it("gives a number field 3 even in a slot, and a slot's second field its name", () => {
    const sample = sampleDataOf([
      storedField("dictionary-term", "Term"),
      storedField("copy-dictionary-term", "Term again"),
      storedField("dictionary-difficulty", "Difficulty", "number"),
    ])
    expect(sample.values).toEqual({
      "dictionary-term": "blossom",
      "copy-dictionary-term": "Term again",
      "dictionary-difficulty": "3",
    })
  })

  it("falls back to the UI language, then English, for a target language without words", () => {
    const fields = [
      storedField("dictionary-term", "Term"),
      storedField("dictionary-definition", "D"),
    ]
    expect(sampleDataOf(fields, { targetCode: "fra", uiLanguage: "ko" })).toMatchObject({
      selection: "blossoms",
      targetCode: "kor",
      values: { "dictionary-definition": "꽃 (특히 과일나무의 꽃)" },
    })
    expect(sampleDataOf(fields, { targetCode: "fra", uiLanguage: "auto" })).toMatchObject({
      selection: "珍惜",
      targetCode: "eng",
      values: { "dictionary-definition": "to cherish; to treasure; to value highly" },
    })
  })

  it("keeps sample data an action already has and is idempotent", () => {
    const own = { selection: "mine", targetCode: "eng", values: { a: "kept" } }
    const config = storedConfig([
      storedAction("with", [storedField("a", "A")], { sampleData: own }),
      storedAction("without", [storedField("b", "B")]),
    ])
    const once = migrate(config)
    expect(once.selectionToolbar.customActions[0]).toBe(config.selectionToolbar.customActions[0])
    expect(once.selectionToolbar.customActions[1].sampleData).toEqual({
      selection: "blossoms",
      targetCode: "cmn",
      values: { b: "B" },
    })
    expect(migrate(once)).toBe(once)
  })

  it("changes nothing else", () => {
    const config = storedConfig([storedAction("a", [storedField("a", "A")])])
    const migrated = migrate(config)
    const { sampleData, ...rest } = migrated.selectionToolbar.customActions[0]
    expect(sampleData).toBeDefined()
    expect(rest).toEqual(config.selectionToolbar.customActions[0])
    expect(migrated.selectionToolbar.builtInActions).toBe(config.selectionToolbar.builtInActions)
    expect({ ...migrated, selectionToolbar: undefined }).toEqual({
      ...config,
      selectionToolbar: undefined,
    })
  })

  it("leaves what it cannot read for the schema to report", () => {
    const noActions = { selectionToolbar: { enabled: true } }
    expect(migrate(noActions)).toBe(noActions)
    expect(migrate(undefined)).toBeUndefined()

    const odd = storedConfig([null, "action", storedAction("a", "not an array" as any)])
    expect(migrate(odd)).toBe(odd)

    const mixed = storedConfig([
      storedAction("a", [null, storedField("b", "B"), { name: "no id" }]),
    ])
    expect(migrate(mixed).selectionToolbar.customActions[0].sampleData.values).toEqual({ b: "B" })
  })
})
