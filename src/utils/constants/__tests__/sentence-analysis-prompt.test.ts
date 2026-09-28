import { readFile } from "node:fs/promises"
import { compileLayout, renderLayoutHtml } from "@read-frog/layout-engine/core"
import {
  SENTENCE_ANALYSIS_CLAUSE_KINDS,
  SENTENCE_ANALYSIS_FORMS,
  SENTENCE_ANALYSIS_OBSTACLES,
  SENTENCE_ANALYSIS_ROLES,
  SENTENCE_ANALYSIS_SENSES,
} from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { SUPPORTED_UI_LOCALES } from "@/utils/i18n/locales"
import { buildCustomActionLayoutScope } from "@/utils/layout-host/host"

// The built-in Sentence Analysis prompt is what keeps models' annotations
// valid and consistent, and the card only styles the values it knows. i18n is
// mocked in tests, so these read the locale files as text: the prompt's lists
// must be the card's vocabularies, its worked examples (which models copy)
// must be answers the card reads as they are, and no locale may replace the
// tested English prompt.

async function readLocale(locale: string): Promise<string[]> {
  const text = await readFile(new URL(`../../../locales/${locale}.yml`, import.meta.url), "utf8")
  return text.split("\n")
}

// The lines of the templates' `sentenceAnalysis` section, its own indentation
// (ten spaces) removed.
function sentenceAnalysisSection(lines: string[]): string[] {
  const start = lines.indexOf("        sentenceAnalysis:")
  expect(start).toBeGreaterThan(-1)
  const section: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line !== "" && !line.startsWith("          ")) break
    section.push(line.slice(10))
  }
  return section
}

// A `key: |-` block scalar of the section.
function blockScalar(section: string[], key: string): string {
  const start = section.indexOf(`${key}: |-`)
  expect(start).toBeGreaterThan(-1)
  const block: string[] = []
  for (const line of section.slice(start + 1)) {
    if (line !== "" && !line.startsWith("  ")) break
    block.push(line.slice(2))
  }
  return block.join("\n").trimEnd()
}

// The keys under each nested map of the section: {roles: ["subject", …], …}.
function nestedKeys(section: string[]): Record<string, string[]> {
  const maps: Record<string, string[]> = {}
  let current: string[] | null = null
  for (const line of section) {
    const group = /^([A-Za-z]+):$/.exec(line)
    if (group) {
      current = []
      maps[group[1]!] = current
      continue
    }
    const entry = /^ {2}([A-Za-z]+): /.exec(line)
    if (entry && current) current.push(entry[1]!)
    else if (!line.startsWith(" ")) current = null
  }
  return maps
}

// The label keys: vocabulary values, camel-cased.
function labelKeys(values: readonly string[]): string[] {
  return values.map((value) =>
    value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
  )
}

function listAfter(prompt: string, key: string): string[] {
  const line = prompt.split("\n").find((candidate) => candidate.startsWith(`- "${key}":`))
  const list = /exactly one of: ([a-z-]+(?:, [a-z-]+)*)\./.exec(line ?? "")?.[1]
  if (list === undefined) throw new Error(`The prompt lists no values for "${key}"`)
  return list.split(", ")
}

interface ExampleItem {
  text: string
  type: string
  form?: string
  sense?: string
  head?: string
  obstacle?: string
  restore?: string
  note?: string
  occurrence?: number
}

interface Example {
  selection: string
  items: ExampleItem[]
}

// Every value the examples give `key`.
function valuesOf(worked: Example[], key: "form" | "sense" | "obstacle"): string[] {
  return worked.flatMap(({ items }) =>
    items.flatMap((item) => (item[key] === undefined ? [] : [item[key]])),
  )
}

function examples(prompt: string): Example[] {
  const found: Example[] = []
  const pattern = /^Selection: (.+)\n\$1: (".*")$/gm
  for (const match of prompt.matchAll(pattern)) {
    // A JSON string holding the compact JSON array, as the model is to write it.
    const value = JSON.parse(match[2]!) as string
    found.push({ selection: match[1]!, items: JSON.parse(value) as Example["items"] })
  }
  return found
}

// Per anchored span: "text" or "head" and the item's index.
function anchoredSpans(example: Example): string[] {
  const compiled = compileLayout(
    '{%- assign a = json | parse_json -%}{%- assign events = ctx.selection | annotate: a, "text", "head" -%}{%- for e in events -%}{%- if e.kind == "enter" -%}{{ e.key }}{{ e.index }},{%- endif -%}{%- endfor -%}',
  )
  if (!compiled.ok) throw compiled.error
  const html = renderLayoutHtml(
    compiled.compiled,
    buildCustomActionLayoutScope({
      outputSchema: [{ id: "json", name: "json", type: "string", description: "" }],
      value: { json: JSON.stringify(example.items) },
      selection: example.selection,
      targetCode: "eng",
      status: "done",
    }),
  )
  return html.split(",").filter(Boolean)
}

const ITEM_KEYS = [
  "text",
  "type",
  "form",
  "sense",
  "head",
  "obstacle",
  "restore",
  "note",
  "occurrence",
]

describe("the built-in Sentence Analysis prompt", () => {
  it("lists exactly the vocabularies the card styles", async () => {
    const prompt = blockScalar(sentenceAnalysisSection(await readLocale("en")), "systemPrompt")

    expect(listAfter(prompt, "type")).toEqual([...SENTENCE_ANALYSIS_ROLES])
    expect(listAfter(prompt, "form")).toEqual(["clause", ...SENTENCE_ANALYSIS_FORMS])
    expect(listAfter(prompt, "sense")).toEqual([...SENTENCE_ANALYSIS_SENSES])
    expect(listAfter(prompt, "obstacle")).toEqual([...SENTENCE_ANALYSIS_OBSTACLES])
    // Everything else it names about the answer: its keys and its two fields.
    for (const key of ITEM_KEYS) expect(prompt).toContain(`- "${key}":`)
    expect(new Set(prompt.match(/\$\d/g))).toEqual(new Set(["$1", "$2"]))
  })

  it("works through examples the card reads as they are", async () => {
    const prompt = blockScalar(sentenceAnalysisSection(await readLocale("en")), "systemPrompt")
    const worked = examples(prompt)
    expect(worked).toHaveLength(3)

    for (const example of worked) {
      for (const item of example.items) {
        for (const key of Object.keys(item)) expect(ITEM_KEYS).toContain(key)
        expect(SENTENCE_ANALYSIS_ROLES).toContain(item.type)
      }
      // Every quote anchors, and so does every head.
      expect(anchoredSpans(example)).toEqual(
        expect.arrayContaining(
          example.items.flatMap((item, index) =>
            item.head === undefined ? [`text${index}`] : [`text${index}`, `head${index}`],
          ),
        ),
      )
    }
    for (const form of valuesOf(worked, "form")) {
      expect(["clause", ...SENTENCE_ANALYSIS_FORMS]).toContain(form)
    }
    for (const sense of valuesOf(worked, "sense")) expect(SENTENCE_ANALYSIS_SENSES).toContain(sense)
    // The examples show the structures models mislabel most.
    expect(new Set(valuesOf(worked, "obstacle"))).toEqual(
      new Set(["ellipsis", "fronting", "inversion", "parenthesis", "passive", "split"]),
    )
  })

  it("is the tested English prompt in every UI language", async () => {
    const overrides: string[] = []
    for (const locale of SUPPORTED_UI_LOCALES.filter((candidate) => candidate !== "en")) {
      const section = sentenceAnalysisSection(await readLocale(locale))
      for (const key of [
        "systemPrompt",
        "prompt",
        "fieldAnnotationsDescription",
        "fieldTranslationDescription",
      ]) {
        if (section.some((line) => line.startsWith(`${key}:`))) overrides.push(`${locale}.${key}`)
      }
    }
    expect(overrides).toEqual([])
  })

  it("has every label of the card in every UI language", async () => {
    const expected = {
      roles: labelKeys(SENTENCE_ANALYSIS_ROLES),
      clauses: labelKeys(SENTENCE_ANALYSIS_CLAUSE_KINDS),
      adverbialClauses: labelKeys(SENTENCE_ANALYSIS_SENSES),
      forms: labelKeys(SENTENCE_ANALYSIS_FORMS),
      senses: labelKeys(SENTENCE_ANALYSIS_SENSES),
      obstacles: labelKeys(SENTENCE_ANALYSIS_OBSTACLES),
    }
    const missing: string[] = []
    for (const locale of SUPPORTED_UI_LOCALES) {
      const section = sentenceAnalysisSection(await readLocale(locale))
      expect({ locale, maps: nestedKeys(section) }).toEqual({ locale, maps: expected })
      for (const key of [
        "name",
        "description",
        "fieldAnnotations",
        "fieldTranslation",
        "restoreLabel",
        "hardLabel",
        "trunkLabel",
        "slashesLabel",
      ]) {
        if (!section.some((line) => line.startsWith(`${key}: `))) missing.push(`${locale}.${key}`)
      }
    }
    expect(missing).toEqual([])
  })
})
