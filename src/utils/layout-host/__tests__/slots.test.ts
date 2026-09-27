import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import {
  buildDictionaryLayout,
  buildSentenceAnalysisLayout,
} from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import {
  CUSTOM_ACTION_TEMPLATES,
  getSentenceAnalysisLayoutLabels,
} from "@/utils/constants/custom-action-templates"
import {
  buildDictionaryActionLayout,
  buildSentenceAnalysisActionLayout,
  getDictionarySlots,
  getSentenceAnalysisSlots,
  isDictionaryShaped,
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
  it("recognizes the preset's ids, with or without a prefix", () => {
    for (const prefix of ["", "copy-"]) {
      const slots = getSentenceAnalysisSlots([
        field(`${prefix}sentence-analysis-annotations`, "A"),
        field(`${prefix}sentence-analysis-translation`, "T"),
        field(`${prefix}sentence-analysis-structure`, "St"),
      ])
      expect(namesBySlot(slots)).toEqual({ annotations: "A", translation: "T", structure: "St" })
    }
  })

  it("ignores UUIDs and near misses, and keeps the first field claiming a slot", () => {
    const ids = [
      crypto.randomUUID(),
      "xsentence-analysis-annotations",
      "sentence-analysis-annotations-2",
      "Sentence-Analysis-Annotations",
      "sentence-analysis-segments",
    ]
    expect(getSentenceAnalysisSlots(ids.map((id) => field(id, id)))).toEqual({})

    const slots = getSentenceAnalysisSlots([
      field("sentence-analysis-annotations", "First"),
      field("copy-sentence-analysis-annotations", "Second"),
    ])
    expect(slots.annotations?.name).toBe("First")
  })

  it("needs the annotations slot to be sentence-analysis-shaped", () => {
    const labels = getSentenceAnalysisLayoutLabels()
    expect(isSentenceAnalysisShaped(presetSchema("sentence-analysis"))).toBe(true)
    const withoutAnnotations = [field("sentence-analysis-translation", "T")]
    expect(isSentenceAnalysisShaped(withoutAnnotations)).toBe(false)
    expect(buildSentenceAnalysisActionLayout(withoutAnnotations, labels)).toBeNull()
  })
})

describe("buildSentenceAnalysisActionLayout", () => {
  it("builds the card for the recognized slots, annotating the selection", () => {
    const labels = getSentenceAnalysisLayoutLabels()
    const schema = presetSchema("sentence-analysis")

    expect(buildSentenceAnalysisActionLayout(schema, labels)).toBe(
      buildSentenceAnalysisLayout({
        slots: {
          annotations: "sentence-analysis-annotations",
          translation: "sentence-analysis-translation",
          structure: "sentence-analysis-structure",
        },
        labels,
        source: { ctxKey: "selection" },
      }),
    )
  })
})
