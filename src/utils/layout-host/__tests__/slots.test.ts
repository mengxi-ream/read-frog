import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { compileLayout, renderLayoutHtml } from "@read-frog/layout-engine/core"
import {
  buildDictionaryLayout,
  buildImproveWritingLayout,
  buildSentenceAnalysisLayout,
} from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { CUSTOM_ACTION_TEMPLATES } from "@/utils/constants/custom-action-templates"
import { buildCustomActionLayoutScope } from "../host"
import {
  buildDictionaryActionLayout,
  buildImproveWritingActionLayout,
  buildSentenceAnalysisActionLayout,
  getDictionarySlots,
  getImproveWritingSlots,
  getSentenceAnalysisSlots,
  isDictionaryShaped,
  isImproveWritingShaped,
  isSentenceAnalysisShaped,
} from "../slots"

type Field = SelectionToolbarCustomActionOutputField

function field(id: string, name: string, overrides: Partial<Field> = {}): Field {
  return { id, name, type: "string", description: "", ...overrides }
}

function presetSchema(id: string): Field[] {
  const template = CUSTOM_ACTION_TEMPLATES.find((candidate) => candidate.id === id)
  if (!template) throw new Error(`${id} preset missing`)
  return template.createAction("provider").outputSchema
}

// createDefaultDictionaryAction's id rewrite (`default-` prefix).
function builtInDictionarySchema(): Field[] {
  return presetSchema("dictionary").map((entry) => ({ ...entry, id: `default-${entry.id}` }))
}

function namesBySlot(slots: Record<string, Field | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(slots).flatMap(([slot, entry]) => (entry ? [[slot, entry.name]] : [])),
  )
}

describe("getDictionarySlots", () => {
  it("recognizes preset and built-in ids", () => {
    for (const prefix of ["", "default-"]) {
      const slots = getDictionarySlots([
        field(`${prefix}dictionary-term`, "T"),
        field(`${prefix}dictionary-phonetic`, "P"),
        field(`${prefix}dictionary-part-of-speech`, "S"),
        field(`${prefix}dictionary-definition`, "D"),
        field(`${prefix}dictionary-context`, "C"),
        field(`${prefix}dictionary-context-term`, "CM"),
        field(`${prefix}dictionary-context-translation`, "CT"),
        field(`${prefix}dictionary-difficulty`, "L"),
        field(`${prefix}dictionary-memory-tips`, "M"),
      ])
      expect(namesBySlot(slots)).toEqual({
        term: "T",
        phonetic: "P",
        partOfSpeech: "S",
        definition: "D",
        context: "C",
        contextTerm: "CM",
        contextTranslation: "CT",
        difficulty: "L",
        memoryTips: "M",
      })
    }
  })

  it("tells context, context-term and context-translation apart in any order", () => {
    const suffixedFirst = getDictionarySlots([
      field("dictionary-context-translation", "CT"),
      field("dictionary-context-term", "CM"),
      field("dictionary-context", "C"),
    ])
    expect(suffixedFirst.context?.name).toBe("C")
    expect(suffixedFirst.contextTerm?.name).toBe("CM")
    expect(suffixedFirst.contextTranslation?.name).toBe("CT")

    const onlyTranslation = getDictionarySlots([field("dictionary-context-translation", "CT")])
    expect(onlyTranslation.context).toBeUndefined()
    expect(onlyTranslation.contextTranslation?.name).toBe("CT")
  })

  it("ignores UUIDs and near misses", () => {
    const ids = [
      crypto.randomUUID(),
      "xdictionary-term",
      "dictionary-terms",
      "dictionary-term-2",
      "dictionary-context-translation-x",
      "dictionary-context-term-x",
      "Dictionary-Term",
    ]
    expect(getDictionarySlots(ids.map((id) => field(id, id)))).toEqual({})
  })

  it("keeps the first field claiming a slot", () => {
    const slots = getDictionarySlots([
      field("dictionary-term", "First"),
      field("default-dictionary-term", "Second"),
    ])
    expect(slots.term?.name).toBe("First")
  })
})

describe("isDictionaryShaped", () => {
  it("needs both a term and a definition", () => {
    expect(isDictionaryShaped(presetSchema("dictionary"))).toBe(true)
    expect(isDictionaryShaped(builtInDictionarySchema())).toBe(true)
    expect(isDictionaryShaped([field("dictionary-term", "T")])).toBe(false)
    expect(isDictionaryShaped([field("dictionary-definition", "D")])).toBe(false)
    expect(
      isDictionaryShaped([field(crypto.randomUUID(), "Term"), field(crypto.randomUUID(), "Def")]),
    ).toBe(false)
  })
})

describe("buildDictionaryActionLayout", () => {
  it("gets no layout when not dictionary-shaped", () => {
    expect(buildDictionaryActionLayout([field("dictionary-term", "T")])).toBeNull()
  })

  it("builds the card for the recognized slots, by field id", () => {
    const schema = [...builtInDictionarySchema(), field("extra", "Extra")]
    const byId = Object.fromEntries(
      Object.entries(getDictionarySlots(schema)).flatMap(([slot, entry]) =>
        entry ? [[slot, entry.id]] : [],
      ),
    )

    const layout = buildDictionaryActionLayout(schema)
    expect(layout).toBe(buildDictionaryLayout({ slots: byId }))
    expect(layout).toContain("default-dictionary-term")
  })
})

describe("getSentenceAnalysisSlots", () => {
  it("recognizes preset and built-in ids, and copies of them", () => {
    for (const prefix of ["", "default-", "copy-"]) {
      const slots = getSentenceAnalysisSlots([
        field(`${prefix}sentence-analysis-annotations`, "A"),
        field(`${prefix}sentence-analysis-translation`, "T"),
      ])
      expect(namesBySlot(slots)).toEqual({ annotations: "A", translation: "T" })
    }
  })

  it("ignores UUIDs and near misses, and keeps the first field claiming a slot", () => {
    const ids = [
      crypto.randomUUID(),
      "xsentence-analysis-annotations",
      "sentence-analysis-annotations-2",
      "Sentence-Analysis-Annotations",
      "sentence-analysis-segments",
      // The first version's third field: a plain row now.
      "sentence-analysis-structure",
    ]
    expect(getSentenceAnalysisSlots(ids.map((id) => field(id, id)))).toEqual({})

    const slots = getSentenceAnalysisSlots([
      field("sentence-analysis-annotations", "First"),
      field("copy-sentence-analysis-annotations", "Second"),
    ])
    expect(slots.annotations?.name).toBe("First")
  })

  it("needs the annotations slot to be sentence-analysis-shaped", () => {
    expect(isSentenceAnalysisShaped(presetSchema("sentence-analysis"))).toBe(true)
    const withoutAnnotations = [field("sentence-analysis-translation", "T")]
    expect(isSentenceAnalysisShaped(withoutAnnotations)).toBe(false)
    expect(buildSentenceAnalysisActionLayout(withoutAnnotations)).toBeNull()
  })
})

describe("buildSentenceAnalysisActionLayout", () => {
  it("builds the card for the recognized slots, annotating the selection", () => {
    const schema = presetSchema("sentence-analysis")

    expect(buildSentenceAnalysisActionLayout(schema)).toBe(
      buildSentenceAnalysisLayout({
        slots: {
          annotations: "sentence-analysis-annotations",
          translation: "sentence-analysis-translation",
        },
        labels: { ctxKey: "sentenceAnalysisLabels" },
        source: { ctxKey: "selection" },
      }),
    )
  })

  it("shows a first-version structure field as a row of its own", () => {
    const schema = [
      ...presetSchema("sentence-analysis"),
      field("sentence-analysis-structure", "Structure"),
    ]
    const compiled = compileLayout(buildSentenceAnalysisActionLayout(schema) ?? "")
    if (!compiled.ok) throw compiled.error
    const html = renderLayoutHtml(
      compiled.compiled,
      buildCustomActionLayoutScope({
        outputSchema: schema,
        value: { Structure: "Main clause first." },
        selection: "It rained.",
        targetCode: "eng",
        status: "done",
      }),
    )
    expect(html).toContain('data-rf-key="sentence-analysis-structure"')
    expect(html).toContain("Main clause first.")
  })
})

describe("getImproveWritingSlots", () => {
  it("recognizes preset ids, the built-in's, and copies of them", () => {
    for (const prefix of ["", "default-", "copy-"]) {
      const slots = getImproveWritingSlots([
        field(`${prefix}improve-writing-setting`, "S"),
        field(`${prefix}improve-writing-annotations`, "A"),
        field(`${prefix}improve-writing-improved`, "I"),
        field(`${prefix}improve-writing-summary`, "U"),
      ])
      expect(namesBySlot(slots)).toEqual({
        setting: "S",
        annotations: "A",
        improved: "I",
        summary: "U",
      })
    }
  })

  it("ignores UUIDs, near misses and the first version's fields", () => {
    const ids = [
      crypto.randomUUID(),
      "ximprove-writing-annotations",
      "improve-writing-annotations-2",
      "Improve-Writing-Improved",
      "improve-writing-error-analysis",
      "sentence-analysis-annotations",
    ]
    expect(getImproveWritingSlots(ids.map((id) => field(id, id)))).toEqual({})
  })

  it("needs the annotations slot to be improve-writing-shaped", () => {
    expect(isImproveWritingShaped(presetSchema("improve-writing"))).toBe(true)
    // The first version's action had no stable ids: it keeps its own layout.
    const firstVersion = [
      field(crypto.randomUUID(), "Error Analysis"),
      field(crypto.randomUUID(), "Improved Version"),
    ]
    expect(isImproveWritingShaped(firstVersion)).toBe(false)
    const withoutAnnotations = [field("improve-writing-improved", "I")]
    expect(isImproveWritingShaped(withoutAnnotations)).toBe(false)
    expect(buildImproveWritingActionLayout(withoutAnnotations)).toBeNull()
    // No shape claims another's fields.
    expect(isSentenceAnalysisShaped(presetSchema("improve-writing"))).toBe(false)
    expect(isImproveWritingShaped(presetSchema("sentence-analysis"))).toBe(false)
  })
})

describe("buildImproveWritingActionLayout", () => {
  it("builds the card for the recognized slots, marking the selection", () => {
    expect(buildImproveWritingActionLayout(presetSchema("improve-writing"))).toBe(
      buildImproveWritingLayout({
        slots: {
          setting: "improve-writing-setting",
          annotations: "improve-writing-annotations",
          improved: "improve-writing-improved",
          summary: "improve-writing-summary",
        },
        labels: { ctxKey: "improveWritingLabels" },
        source: { ctxKey: "selection" },
      }),
    )
  })

  it("renders an answer with the words of the reader's language", () => {
    const schema = presetSchema("improve-writing")
    const slots = getImproveWritingSlots(schema)
    const compiled = compileLayout(buildImproveWritingActionLayout(schema) ?? "")
    if (!compiled.ok) throw compiled.error
    const html = renderLayoutHtml(
      compiled.compiled,
      buildCustomActionLayoutScope({
        outputSchema: schema,
        value: {
          [slots.setting!.name]: "正式 · 邮件",
          [slots.annotations!.name]: JSON.stringify([
            { text: "I very like", fix: "I really like", type: "grammar", note: "n" },
          ]),
          [slots.improved!.name]: "I really like it.",
          [slots.summary!.name]: "s",
        },
        selection: "I very like it.",
        targetCode: "cmn",
        status: "done",
      }),
    )
    const prefix = "options.selectionToolbar.customActions.templates.improveWriting"
    // The i18n mock tags each word with the locale it was asked in.
    expect(html).toContain(`${prefix}.types.grammar@zh-CN`)
    expect(html).toContain(`data-toggle="off-error"><i></i>${prefix}.tiers.error@zh-CN 1</button>`)
    expect(html).toContain("<rt>I really like</rt>")
    expect(html).toContain('data-copy="I really like it."')
  })
})
