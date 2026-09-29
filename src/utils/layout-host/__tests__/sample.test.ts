import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { compileLayout, renderLayoutHtml } from "@read-frog/layout-engine/core"
import {
  IMPROVE_WRITING_TYPES,
  SENTENCE_ANALYSIS_FORMS,
  SENTENCE_ANALYSIS_OBSTACLES,
  SENTENCE_ANALYSIS_ROLES,
  SENTENCE_ANALYSIS_SENSES,
} from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { CUSTOM_ACTION_TEMPLATES } from "@/utils/constants/custom-action-templates"
import { SUPPORTED_UI_LOCALES } from "@/utils/i18n/locales"
import { buildCustomActionLayoutScope } from "../host"
import { langCodeOfLocale } from "../labels"
import {
  buildStreamingFrames,
  createLayoutSampleData,
  layoutSampleValues,
  syncLayoutSampleData,
} from "../sample"
import { getDictionarySlots, getImproveWritingSlots, getSentenceAnalysisSlots } from "../slots"

type Field = SelectionToolbarCustomActionOutputField

function field(id: string, name: string, overrides: Partial<Field> = {}): Field {
  return { id, name, type: "string", description: "", ...overrides }
}

function presetSchema(id: string): Field[] {
  const template = CUSTOM_ACTION_TEMPLATES.find((candidate) => candidate.id === id)
  if (!template) throw new Error(`${id} preset missing`)
  return template.createAction("provider").outputSchema
}

function dictionarySchema(): Field[] {
  return presetSchema("dictionary")
}

// Renders `source` with one string field, `json`, holding `text`: the way a
// layout sees a model's JSON-in-a-string answer.
function renderWithJson(source: string, text: unknown, selection = ""): string {
  const compiled = compileLayout(source)
  if (!compiled.ok) throw compiled.error
  return renderLayoutHtml(
    compiled.compiled,
    buildCustomActionLayoutScope({
      outputSchema: [field("json", "json")],
      value: { json: text },
      selection,
      targetCode: "cmn",
      status: "done",
    }),
  )
}

// How many complete items `parse_json` reads from a (possibly truncated) array.
function parsedCount(text: unknown): number {
  return Number(renderWithJson("{%- assign a = json | parse_json -%}{{ a | size }}", text) || 0)
}

// How many `head` words the `annotate` filter links onto `selection`.
function linkedHeadCount(annotations: string, selection: string): number {
  const html = renderWithJson(
    '{%- assign a = json | parse_json -%}{%- assign events = ctx.selection | annotate: a, "text", "head" -%}{%- for e in events -%}{%- if e.kind == "enter" and e.key == "head" -%}h{%- endif -%}{%- endfor -%}',
    annotations,
    selection,
  )
  return html.length
}

// Where the marks and their fixes land: `annotate` over the selection by
// `text`, and over the improved text by `fix`.
function anchoredCount(annotations: string, text: string, key = "text"): number {
  const html = renderWithJson(
    `{%- assign a = json | parse_json -%}{%- assign events = ctx.selection | annotate: a, "${key}" -%}{%- for e in events -%}{%- if e.kind == "enter" -%}m{%- endif -%}{%- endfor -%}`,
    annotations,
    text,
  )
  return html.length
}

interface SampleAnnotation {
  text: string
  type: string
  form?: string
  sense?: string
  head?: string
  obstacle?: string
  note?: string
}

// The nesting depth of every annotation the `annotate` filter anchors onto
// `selection`.
function annotatedDepths(annotations: string, selection: string): number[] {
  const html = renderWithJson(
    '{%- assign a = json | parse_json -%}{%- assign events = ctx.selection | annotate: a -%}{%- for e in events -%}{%- if e.kind == "enter" -%}{{ e.depth }},{%- endif -%}{%- endfor -%}',
    annotations,
    selection,
  )
  return html
    .split(",")
    .filter(Boolean)
    .map((depth) => Number(depth))
}

// The sample written for a reader of `locale`'s language.
function sampleIn(schema: Field[], locale: SupportedUiLocale) {
  return createLayoutSampleData(schema, langCodeOfLocale(locale))
}

describe("createLayoutSampleData", () => {
  it("explains an English word in a non-English UI language", () => {
    const schema = dictionarySchema()
    const slots = getDictionarySlots(schema)
    const { values } = sampleIn(schema, "zh-CN")

    expect(values[slots.term!.id]).toBe("blossom")
    expect(values[slots.phonetic!.id]).toBe("/ˈblɒs.əm/")
    expect(values[slots.partOfSpeech!.id]).toBe("noun")
    expect(values[slots.definition!.id]).toBe("花；花朵（尤指果树的花）")
    expect(values[slots.context!.id]).toBe(
      "The ephemeral beauty of cherry blossoms reminds us to cherish each moment.",
    )
    expect(values[slots.contextTerm!.id]).toBe('[{"text":"blossoms"}]')
    expect(values[slots.contextTranslation!.id]).toBe("樱花短暂的美丽提醒我们珍惜每一刻。")
    expect(values[slots.difficulty!.id]).toBe("B2")
    expect(Object.keys(values)).toEqual(schema.map((entry) => entry.id))
  })

  it("explains a Chinese word in English for an English reader, the default", () => {
    const schema = dictionarySchema()
    const slots = getDictionarySlots(schema)
    const sample = sampleIn(schema, "en")

    expect(sample.values[slots.term!.id]).toBe("珍惜")
    expect(sample.values[slots.context!.id]).toBe("樱花短暂的美丽提醒我们珍惜每一刻。")
    expect(sample.values[slots.contextTerm!.id]).toBe('[{"text":"珍惜"}]')
    expect(sample.values[slots.definition!.id]).toBe("to cherish; to treasure; to value highly")
    // A target language the extension has no words in gets the UI language's.
    expect(createLayoutSampleData(schema, "fra")).toEqual(sample)
  })

  it.each(SUPPORTED_UI_LOCALES)("gives %s a sample whose term quotes anchor", (locale) => {
    const schema = dictionarySchema()
    const slots = getDictionarySlots(schema)
    const { selection, values } = sampleIn(schema, locale)
    const sentence = values[slots.context!.id]!
    const quotes = values[slots.contextTerm!.id]!

    for (const slot of Object.values(slots)) expect(values[slot.id]).not.toBe("")
    expect(annotatedDepths(quotes, sentence)).toHaveLength((JSON.parse(quotes) as unknown[]).length)
    expect(sentence).toContain(selection)
    // English looks up Chinese; every other language looks up English.
    expect(/\p{Script=Han}/u.test(sentence)).toBe(locale === "en")
  })

  it("explains the word in each UI language's own words", () => {
    const schema = dictionarySchema()
    const id = getDictionarySlots(schema).definition!.id
    const definitions = SUPPORTED_UI_LOCALES.map((locale) => sampleIn(schema, locale).values[id])
    expect(new Set(definitions).size).toBe(SUPPORTED_UI_LOCALES.length)
  })

  it("recognizes the built-in's default-dictionary-* ids too", () => {
    const schema = dictionarySchema().map((entry) => ({ ...entry, id: `default-${entry.id}` }))
    const term = getDictionarySlots(schema).term!
    expect(sampleIn(schema, "ja").values[term.id]).toBe("blossom")
  })

  it.each(SUPPORTED_UI_LOCALES)(
    "gives %s a sentence analysis sample that anchors and keeps to the card's vocabularies",
    (locale) => {
      const schema = presetSchema("sentence-analysis")
      const slots = getSentenceAnalysisSlots(schema)
      const { selection, values } = sampleIn(schema, locale)

      // A JSON array inside a string, compact like a model writes it.
      const text = values[slots.annotations!.id]!
      const annotations = JSON.parse(text) as SampleAnnotation[]
      expect(text).toBe(JSON.stringify(annotations))
      // Every quote anchors onto the sentence, nested, and so does every head.
      const depths = annotatedDepths(text, selection)
      expect(depths).toHaveLength(annotations.length)
      expect(Math.max(...depths)).toBeGreaterThanOrEqual(2)
      expect(linkedHeadCount(text, selection)).toBe(
        annotations.filter((annotation) => annotation.head !== undefined).length,
      )
      const valuesOf = (key: "type" | "form" | "sense" | "obstacle") =>
        annotations.flatMap((annotation) =>
          annotation[key] === undefined ? [] : [annotation[key]],
        )
      for (const type of valuesOf("type")) expect(SENTENCE_ANALYSIS_ROLES).toContain(type)
      for (const form of valuesOf("form")) {
        expect(["clause", ...SENTENCE_ANALYSIS_FORMS]).toContain(form)
      }
      for (const sense of valuesOf("sense")) expect(SENTENCE_ANALYSIS_SENSES).toContain(sense)
      for (const obstacle of valuesOf("obstacle")) {
        expect(SENTENCE_ANALYSIS_OBSTACLES).toContain(obstacle)
      }
      expect(annotations.some((annotation) => annotation.note)).toBe(true)
      expect(values[slots.translation!.id]).not.toBe("")
      // English analyses a Chinese sentence; every other language an English one.
      expect(/\p{Script=Han}/u.test(selection)).toBe(locale === "en")
    },
  )

  it("explains the sentence in each UI language's own words", () => {
    const schema = presetSchema("sentence-analysis")
    const slots = getSentenceAnalysisSlots(schema)
    for (const slot of [slots.annotations!, slots.translation!]) {
      const texts = SUPPORTED_UI_LOCALES.map((locale) => sampleIn(schema, locale).values[slot.id])
      expect(new Set(texts).size).toBe(SUPPORTED_UI_LOCALES.length)
    }
  })

  it("recognizes the built-in's default-sentence-analysis-* ids too", () => {
    const schema = presetSchema("sentence-analysis").map((entry) => ({
      ...entry,
      id: `default-${entry.id}`,
    }))
    const translation = getSentenceAnalysisSlots(schema).translation!
    expect(sampleIn(schema, "zh-CN").values[translation.id]).toContain("委员会推迟了")
  })

  it.each(SUPPORTED_UI_LOCALES)(
    "gives %s an Improve Writing sample whose marks and fixes all anchor",
    (locale) => {
      const schema = presetSchema("improve-writing")
      const slots = getImproveWritingSlots(schema)
      const { selection, values } = sampleIn(schema, locale)

      const text = values[slots.annotations!.id]!
      const marks = JSON.parse(text) as Array<{
        text: string
        fix?: string
        type: string
        note: string
      }>
      expect(text).toBe(JSON.stringify(marks))
      // Every quote anchors onto the selection, and every fix onto the rewrite.
      expect(anchoredCount(text, selection)).toBe(marks.length)
      const improved = values[slots.improved!.id]!
      expect(anchoredCount(text, improved, "fix")).toBe(marks.filter((mark) => mark.fix).length)
      for (const mark of marks) {
        expect(IMPROVE_WRITING_TYPES).toContain(mark.type)
        expect(mark.note).not.toBe("")
      }
      // Every tier shows: an error, something awkward, a choice worth keeping.
      expect(new Set(marks.map((mark) => mark.type))).toEqual(
        new Set(
          locale === "en" ? ["good", "grammar", "unnatural"] : ["good", "register", "grammar"],
        ),
      )
      expect(values[slots.setting!.id]).not.toBe("")
      expect(values[slots.summary!.id]).not.toBe("")
      // English marks a Chinese learner's sentence; every other language an English email.
      expect(/\p{Script=Han}/u.test(selection)).toBe(locale === "en")
    },
  )

  it("marks the email in each UI language's own words", () => {
    const schema = presetSchema("improve-writing")
    const slots = getImproveWritingSlots(schema)
    for (const slot of [slots.setting!, slots.annotations!, slots.summary!]) {
      const texts = SUPPORTED_UI_LOCALES.map((locale) => sampleIn(schema, locale).values[slot.id])
      expect(new Set(texts).size).toBe(SUPPORTED_UI_LOCALES.length)
    }
  })

  // A sample is an answer written in the locale's language, so that language
  // is its target language: the card's words follow it like the notes do.
  it("picks the selection by the action's shape and the answer's language", () => {
    const pick = (schema: Field[], targetCode: LangCodeISO6393) => {
      const { selection, targetCode: written } = createLayoutSampleData(schema, targetCode)
      return { selection, targetCode: written }
    }
    const sentenceAnalysis = presetSchema("sentence-analysis")
    expect(pick(sentenceAnalysis, "jpn")).toEqual({
      selection: expect.stringMatching(/^The committee has postponed/),
      targetCode: "jpn",
    })
    expect(pick(sentenceAnalysis, "eng")).toEqual({
      selection: expect.stringMatching(/^虽然/),
      targetCode: "eng",
    })
    expect(pick(sentenceAnalysis, "fra")).toEqual(pick(sentenceAnalysis, "eng"))
    expect(pick(dictionarySchema(), "eng")).toEqual({ selection: "珍惜", targetCode: "eng" })
    expect(pick(dictionarySchema(), "cmn-Hant")).toEqual({
      selection: "blossoms",
      targetCode: "cmn-Hant",
    })
    const improveWriting = presetSchema("improve-writing")
    expect(pick(improveWriting, "vie")).toEqual({
      selection: expect.stringMatching(/^Dear Professor Lee/),
      targetCode: "vie",
    })
    expect(pick(improveWriting, "eng")).toEqual({
      selection: expect.stringMatching(/^我昨天/),
      targetCode: "eng",
    })
    expect(pick([field("a", "Summary")], "kor")).toEqual({
      selection: "blossoms",
      targetCode: "kor",
    })
  })

  it("gives other string fields their name and number fields 3, as text", () => {
    expect(
      createLayoutSampleData(
        [field("a", "Summary"), field("b", "Score", { type: "number" })],
        "eng",
      ),
    ).toEqual({ selection: "珍惜", targetCode: "eng", values: { a: "Summary", b: "3" } })
  })
})

describe("syncLayoutSampleData", () => {
  const schema = [field("a", "Summary"), field("b", "Score", { type: "number" })]
  const saved = { selection: "My text", targetCode: "jpn" as const, values: { a: "Mine", b: "12" } }

  it("keeps the saved sample while the fields stay, by id through a rename", () => {
    expect(syncLayoutSampleData(saved, schema, "eng")).toEqual(saved)
    const renamed = [field("a", "Gist"), field("b", "Score", { type: "number" })]
    expect(syncLayoutSampleData(saved, renamed, "eng")).toEqual(saved)
  })

  it("keeps an emptied value, so the preview can show a blank field", () => {
    const emptied = { ...saved, values: { a: "", b: "12" } }
    expect(syncLayoutSampleData(emptied, schema, "eng")).toEqual(emptied)
  })

  it("drops a removed field's value and gives a new field one in the sample's language", () => {
    const definition = getDictionarySlots(dictionarySchema()).definition!
    const next = syncLayoutSampleData(saved, [field("b", "Score"), definition], "eng")
    expect(next).toEqual({
      selection: "My text",
      targetCode: "jpn",
      values: {
        b: "12",
        [definition.id]: sampleIn(dictionarySchema(), "ja").values[definition.id],
      },
    })
    expect(Object.keys(next.values)).toEqual(["b", definition.id])
  })

  it("creates a new sample for the reader when there is none", () => {
    expect(syncLayoutSampleData(undefined, schema, "kor")).toEqual(
      createLayoutSampleData(schema, "kor"),
    )
  })
})

describe("layoutSampleValues", () => {
  it("keys the values by field name, like a model's answer", () => {
    const sample = { selection: "s", targetCode: "eng" as const, values: { a: "Mine", b: "12" } }
    expect(
      layoutSampleValues(sample, [field("a", "Gist"), field("b", "Score", { type: "number" })]),
    ).toEqual({ Gist: "Mine", Score: "12" })
    expect(layoutSampleValues(sample, [field("c", "New")])).toEqual({ New: "" })
  })

  it("keeps odd field names as own keys", () => {
    const sample = createLayoutSampleData(
      [field("a", "__proto__"), field("b", "constructor")],
      "eng",
    )
    const values = layoutSampleValues(sample, [field("a", "__proto__"), field("b", "constructor")])
    expect(Object.hasOwn(values, "__proto__")).toBe(true)
    expect(values.constructor).toBe("constructor")
  })

  it("streams the sample's annotations in one at a time", () => {
    const schema = presetSchema("sentence-analysis")
    const name = getSentenceAnalysisSlots(schema).annotations!.name
    const values = layoutSampleValues(sampleIn(schema, "en"), schema)
    const total = (JSON.parse(values[name]!) as unknown[]).length

    const counts = buildStreamingFrames(values, schema).map((frame) => parsedCount(frame[name]))
    expect(counts[0]).toBe(0)
    expect(counts.at(-1)).toBe(total)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]! - counts[i - 1]!).toBeGreaterThanOrEqual(0)
      expect(counts[i]! - counts[i - 1]!).toBeLessThanOrEqual(1)
    }
  })
})

describe("buildStreamingFrames", () => {
  const schema = [
    field("a", "first"),
    field("b", "count", { type: "number" }),
    field("c", "second"),
  ]
  const values = { first: "Hello, world", count: 7, second: "你好😀世界", extra: "ignored" }

  it("starts empty, ends complete and only ever extends the previous frame", () => {
    const frames = buildStreamingFrames(values, schema, { maxFrames: 5 })

    expect(frames[0]).toEqual({})
    expect(frames.at(-1)).toEqual({ first: "Hello, world", count: 7, second: "你好😀世界" })
    for (let i = 1; i < frames.length; i++) {
      const previous = frames[i - 1]!
      const next = frames[i]!
      expect(next).not.toBe(previous)
      for (const [name, value] of Object.entries(previous)) {
        const extended =
          typeof value === "string" ? String(next[name]).startsWith(value) : next[name] === value
        expect(Object.hasOwn(next, name) && extended).toBe(true)
      }
      expect(Object.keys(next).length - Object.keys(previous).length).toBeLessThanOrEqual(1)
    }
  })

  it("delivers fields in schema order", () => {
    const frames = buildStreamingFrames(values, schema)
    const order = frames.map((frame) => Object.keys(frame).join(","))
    expect(order).toContain("first")
    expect(order).toContain("first,count")
    expect(order.at(-1)).toBe("first,count,second")
    expect(order.some((keys) => keys.startsWith("count") || keys.startsWith("second"))).toBe(false)
  })

  it("never splits a surrogate pair", () => {
    const frames = buildStreamingFrames({ second: "😀😀😀" }, schema, { maxFrames: 100 })
    expect(frames.map((frame) => frame.second)).toEqual([undefined, "😀", "😀😀", "😀😀😀"])
  })

  it("stays near the frame budget for long text", () => {
    const long = { first: "x".repeat(10_000), second: "y".repeat(10_000) }
    const frames = buildStreamingFrames(long, schema, { maxFrames: 40 })
    expect(frames.length).toBeLessThanOrEqual(40 + schema.length + 1)
    expect(frames.at(-1)).toEqual(long)
  })

  it("keeps an empty string as its own frame and reads own keys only", () => {
    const frames = buildStreamingFrames({ first: "" }, [
      field("a", "first"),
      field("b", "toString"),
    ])
    expect(frames).toEqual([{}, { first: "" }])
  })
})
