import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
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
import {
  buildLayoutSampleValues,
  buildStreamingFrames,
  getLayoutSampleContext,
  LAYOUT_SAMPLE_NUMBER,
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

describe("buildLayoutSampleValues", () => {
  it("explains an English word in a non-English UI language", () => {
    const schema = dictionarySchema()
    const slots = getDictionarySlots(schema)
    const values = buildLayoutSampleValues(schema, { locale: "zh-CN" })

    expect(values[slots.term!.name]).toBe("blossom")
    expect(values[slots.phonetic!.name]).toBe("/ˈblɒs.əm/")
    expect(values[slots.partOfSpeech!.name]).toBe("noun")
    expect(values[slots.definition!.name]).toBe("花；花朵（尤指果树的花）")
    expect(values[slots.context!.name]).toBe(
      "The ephemeral beauty of cherry blossoms reminds us to cherish each moment.",
    )
    expect(values[slots.contextTerm!.name]).toBe('[{"text":"blossoms"}]')
    expect(values[slots.contextTranslation!.name]).toBe("樱花短暂的美丽提醒我们珍惜每一刻。")
    expect(values[slots.difficulty!.name]).toBe("B2")
    expect(Object.keys(values)).toEqual(schema.map((entry) => entry.name))
  })

  it("explains a Chinese word in English for the English UI, the default", () => {
    const schema = dictionarySchema()
    const slots = getDictionarySlots(schema)
    const values = buildLayoutSampleValues(schema, { locale: "en" })

    expect(values[slots.term!.name]).toBe("珍惜")
    expect(values[slots.context!.name]).toBe("樱花短暂的美丽提醒我们珍惜每一刻。")
    expect(values[slots.contextTerm!.name]).toBe('[{"text":"珍惜"}]')
    expect(values[slots.definition!.name]).toBe("to cherish; to treasure; to value highly")
    expect(buildLayoutSampleValues(schema)).toEqual(values)
    expect(buildLayoutSampleValues(schema, { locale: "xx" })).toEqual(values)
  })

  it.each(SUPPORTED_UI_LOCALES)("gives %s a sample whose term quotes anchor", (locale) => {
    const schema = dictionarySchema()
    const slots = getDictionarySlots(schema)
    const values = buildLayoutSampleValues(schema, { locale })
    const sentence = String(values[slots.context!.name])
    const quotes = String(values[slots.contextTerm!.name])

    for (const slot of Object.values(slots)) expect(values[slot.name]).not.toBe("")
    expect(annotatedDepths(quotes, sentence)).toHaveLength((JSON.parse(quotes) as unknown[]).length)
    expect(sentence).toContain(getLayoutSampleContext(schema, locale).selection)
    // English looks up Chinese; every other language looks up English.
    expect(/\p{Script=Han}/u.test(sentence)).toBe(locale === "en")
  })

  it("explains the word in each UI language's own words", () => {
    const schema = dictionarySchema()
    const name = getDictionarySlots(schema).definition!.name
    const definitions = SUPPORTED_UI_LOCALES.map(
      (locale) => buildLayoutSampleValues(schema, { locale })[name],
    )
    expect(new Set(definitions).size).toBe(SUPPORTED_UI_LOCALES.length)
  })

  it("recognizes the built-in's default-dictionary-* ids too", () => {
    const schema = dictionarySchema().map((entry) => ({ ...entry, id: `default-${entry.id}` }))
    const term = getDictionarySlots(schema).term!
    expect(buildLayoutSampleValues(schema, { locale: "ja" })[term.name]).toBe("blossom")
  })

  it.each(SUPPORTED_UI_LOCALES)(
    "gives %s a sentence analysis sample that anchors and keeps to the card's vocabularies",
    (locale) => {
      const schema = presetSchema("sentence-analysis")
      const slots = getSentenceAnalysisSlots(schema)
      const values = buildLayoutSampleValues(schema, { locale })
      const { selection } = getLayoutSampleContext(schema, locale)

      // A JSON array inside a string, compact like a model writes it.
      const text = String(values[slots.annotations!.name])
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
      expect(values[slots.translation!.name]).not.toBe("")
      // English analyses a Chinese sentence; every other language an English one.
      expect(/\p{Script=Han}/u.test(selection)).toBe(locale === "en")
    },
  )

  it("explains the sentence in each UI language's own words", () => {
    const schema = presetSchema("sentence-analysis")
    const slots = getSentenceAnalysisSlots(schema)
    for (const slot of [slots.annotations!, slots.translation!]) {
      const texts = SUPPORTED_UI_LOCALES.map(
        (locale) => buildLayoutSampleValues(schema, { locale })[slot.name],
      )
      expect(new Set(texts).size).toBe(SUPPORTED_UI_LOCALES.length)
    }
  })

  it("streams the sample's annotations in one at a time", () => {
    const schema = presetSchema("sentence-analysis")
    const name = getSentenceAnalysisSlots(schema).annotations!.name
    const values = buildLayoutSampleValues(schema)
    const total = (JSON.parse(String(values[name])) as unknown[]).length

    const counts = buildStreamingFrames(values, schema).map((frame) => parsedCount(frame[name]))
    expect(counts[0]).toBe(0)
    expect(counts.at(-1)).toBe(total)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]! - counts[i - 1]!).toBeGreaterThanOrEqual(0)
      expect(counts[i]! - counts[i - 1]!).toBeLessThanOrEqual(1)
    }
  })

  it("recognizes the built-in's default-sentence-analysis-* ids too", () => {
    const schema = presetSchema("sentence-analysis").map((entry) => ({
      ...entry,
      id: `default-${entry.id}`,
    }))
    const translation = getSentenceAnalysisSlots(schema).translation!
    expect(buildLayoutSampleValues(schema, { locale: "zh-CN" })[translation.name]).toContain(
      "委员会推迟了",
    )
  })

  it.each(SUPPORTED_UI_LOCALES)(
    "gives %s an Improve Writing sample whose marks and fixes all anchor",
    (locale) => {
      const schema = presetSchema("improve-writing")
      const slots = getImproveWritingSlots(schema)
      const values = buildLayoutSampleValues(schema, { locale })
      const { selection } = getLayoutSampleContext(schema, locale)

      const text = String(values[slots.annotations!.name])
      const marks = JSON.parse(text) as Array<{
        text: string
        fix?: string
        type: string
        note: string
      }>
      expect(text).toBe(JSON.stringify(marks))
      // Every quote anchors onto the selection, and every fix onto the rewrite.
      expect(anchoredCount(text, selection)).toBe(marks.length)
      const improved = String(values[slots.improved!.name])
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
      expect(values[slots.setting!.name]).not.toBe("")
      expect(values[slots.summary!.name]).not.toBe("")
      // English marks a Chinese learner's sentence; every other language an English email.
      expect(/\p{Script=Han}/u.test(selection)).toBe(locale === "en")
    },
  )

  it("marks the email in each UI language's own words", () => {
    const schema = presetSchema("improve-writing")
    const slots = getImproveWritingSlots(schema)
    for (const slot of [slots.setting!, slots.annotations!, slots.summary!]) {
      const texts = SUPPORTED_UI_LOCALES.map(
        (locale) => buildLayoutSampleValues(schema, { locale })[slot.name],
      )
      expect(new Set(texts).size).toBe(SUPPORTED_UI_LOCALES.length)
    }
  })

  // A sample is an answer written in the locale's language, so that language
  // is its target language: the card's words follow it like the notes do.
  it("picks the sample context by the action's shape and the answer's language", () => {
    const sentenceAnalysis = presetSchema("sentence-analysis")
    expect(getLayoutSampleContext(sentenceAnalysis, "ja")).toEqual({
      selection: expect.stringMatching(/^The committee has postponed/),
      targetCode: "jpn",
    })
    expect(getLayoutSampleContext(sentenceAnalysis, "en")).toEqual({
      selection: expect.stringMatching(/^虽然/),
      targetCode: "eng",
    })
    expect(getLayoutSampleContext(sentenceAnalysis, "xx")).toEqual(
      getLayoutSampleContext(sentenceAnalysis, "en"),
    )
    expect(getLayoutSampleContext(dictionarySchema(), "en")).toEqual({
      selection: "珍惜",
      targetCode: "eng",
    })
    expect(getLayoutSampleContext(dictionarySchema(), "zh-TW")).toEqual({
      selection: "blossoms",
      targetCode: "cmn-Hant",
    })
    const improveWriting = presetSchema("improve-writing")
    expect(getLayoutSampleContext(improveWriting, "vi")).toEqual({
      selection: expect.stringMatching(/^Dear Professor Lee/),
      targetCode: "vie",
    })
    expect(getLayoutSampleContext(improveWriting, "en")).toEqual({
      selection: expect.stringMatching(/^我昨天/),
      targetCode: "eng",
    })
    expect(getLayoutSampleContext([field("a", "Summary")], "ko")).toEqual({
      selection: "blossoms",
      targetCode: "kor",
    })
  })

  it("uses a placeholder for other string fields and a number for number fields", () => {
    const schema = [field("a", "Summary"), field("b", "Score", { type: "number" })]

    expect(buildLayoutSampleValues(schema)).toEqual({ Summary: "Summary", Score: 3 })
    expect(
      buildLayoutSampleValues(schema, { placeholder: (entry) => `Sample ${entry.name}` }),
    ).toEqual({ Summary: "Sample Summary", Score: LAYOUT_SAMPLE_NUMBER })
  })

  it("applies edited samples by field id, so they follow a rename", () => {
    const before = [field("a", "Summary"), field("b", "Score", { type: "number" })]
    const overrides = { a: "Edited", b: "12" }
    expect(buildLayoutSampleValues(before, { overrides })).toEqual({
      Summary: "Edited",
      Score: "12",
    })

    const renamed = [field("a", "Gist"), field("b", "Score", { type: "number" })]
    expect(buildLayoutSampleValues(renamed, { overrides })).toEqual({ Gist: "Edited", Score: "12" })
  })

  it("keeps an emptied sample, so the preview can show a blank field", () => {
    expect(buildLayoutSampleValues([field("a", "Summary")], { overrides: { a: "" } })).toEqual({
      Summary: "",
    })
  })

  it("keeps odd field names as own keys", () => {
    const values = buildLayoutSampleValues([field("a", "__proto__"), field("b", "constructor")])
    expect(Object.hasOwn(values, "__proto__")).toBe(true)
    expect(values.constructor).toBe("constructor")
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
