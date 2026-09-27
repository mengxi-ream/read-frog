import type { DictionarySlot, SentenceAnalysisSlot } from "@read-frog/layout-engine/presets"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { DEFAULT_UI_LOCALE } from "@/utils/i18n/locales"
import { getDictionarySlots, getSentenceAnalysisSlots, isSentenceAnalysisShaped } from "./slots"

// Sample results for the layout preview on the options page. Values are keyed
// by field NAME, the shape a model's structured output has; user edits to the
// samples are keyed by field id so they survive a rename.

// A worked Dictionary answer per UI language, so the preview reads like a
// lookup by someone who uses that language: an English word explained in the
// UI language, or, in English, a Chinese word explained in English.
interface DictionarySample {
  selection: string
  targetLanguage: string
  values: Record<DictionarySlot, string>
}

function englishWordSample(
  targetLanguage: string,
  definition: string,
  contextTranslation: string,
): DictionarySample {
  return {
    selection: "blossoms",
    targetLanguage,
    values: {
      term: "blossom",
      phonetic: "/ˈblɒs.əm/",
      partOfSpeech: "noun",
      definition,
      context: "The ephemeral beauty of cherry blossoms reminds us to cherish each moment.",
      contextTerm: '[{"text":"blossoms"}]',
      contextTranslation,
      difficulty: "B2",
    },
  }
}

const DICTIONARY_SAMPLES: Record<SupportedUiLocale, DictionarySample> = {
  en: {
    selection: "珍惜",
    targetLanguage: "English",
    values: {
      term: "珍惜",
      phonetic: "zhēnxī",
      partOfSpeech: "verb",
      definition: "to cherish; to treasure; to value highly",
      context: "樱花短暂的美丽提醒我们珍惜每一刻。",
      contextTerm: '[{"text":"珍惜"}]',
      contextTranslation:
        "The fleeting beauty of cherry blossoms reminds us to cherish every moment.",
      difficulty: "B1",
    },
  },
  "zh-CN": englishWordSample(
    "Simplified Mandarin Chinese",
    "花；花朵（尤指果树的花）",
    "樱花短暂的美丽提醒我们珍惜每一刻。",
  ),
  "zh-TW": englishWordSample(
    "Traditional Mandarin Chinese",
    "花；花朵（尤指果樹的花）",
    "櫻花短暫的美麗提醒我們珍惜每一刻。",
  ),
  ja: englishWordSample(
    "Japanese",
    "花（特に果樹の花）",
    "桜のはかない美しさは、一瞬一瞬を大切にするよう私たちに思い出させてくれる。",
  ),
  ko: englishWordSample(
    "Korean",
    "꽃 (특히 과일나무의 꽃)",
    "벚꽃의 덧없는 아름다움은 매 순간을 소중히 여기라고 우리에게 일깨워 준다.",
  ),
  ru: englishWordSample(
    "Russian",
    "цветок; цветение (особенно плодовых деревьев)",
    "Мимолётная красота цветущей вишни напоминает нам ценить каждое мгновение.",
  ),
  tr: englishWordSample(
    "Turkish",
    "çiçek (özellikle meyve ağaçlarının çiçeği)",
    "Kiraz çiçeklerinin geçici güzelliği bize her anın kıymetini bilmemizi hatırlatır.",
  ),
  vi: englishWordSample(
    "Vietnamese",
    "hoa (đặc biệt là hoa của cây ăn quả)",
    "Vẻ đẹp phù du của hoa anh đào nhắc nhở chúng ta trân trọng từng khoảnh khắc.",
  ),
  es: englishWordSample(
    "Spanish",
    "flor (especialmente la de un árbol frutal)",
    "La belleza efímera de los cerezos en flor nos recuerda valorar cada momento.",
  ),
  az: englishWordSample(
    "Azerbaijani",
    "çiçək (xüsusilə meyvə ağacının çiçəyi)",
    "Albalı çiçəklərinin ötəri gözəlliyi bizə hər anın qədrini bilməyi xatırladır.",
  ),
}

// The UI language's sample; an unknown language gets the default one.
function dictionarySampleFor(locale: string | undefined): DictionarySample {
  return locale !== undefined && Object.hasOwn(DICTIONARY_SAMPLES, locale)
    ? DICTIONARY_SAMPLES[locale as SupportedUiLocale]
    : DICTIONARY_SAMPLES[DEFAULT_UI_LOCALE]
}

// A real answer to the Sentence Analysis preset's prompt (deepseek-chat,
// target language Chinese), so a sentence-analysis-shaped action previews
// with what a model actually returns: annotations quoting nested parts of the
// sentence, as a JSON array inside a string, which the preview's replay
// streams in a chunk at a time (each annotation appears once it is complete).
export const SENTENCE_ANALYSIS_SAMPLE_SELECTION =
  "The committee has postponed the decision which was expected last week, citing concerns that the proposal, if implemented hastily, could undermine public trust."
const SENTENCE_ANALYSIS_SAMPLE_TARGET_LANGUAGE = "Simplified Mandarin Chinese"

const SENTENCE_ANALYSIS_SAMPLE_ANNOTATIONS = [
  { text: "The committee", type: "subject", note: "主语", hard: false },
  { text: "has postponed", type: "predicate", note: "现在完成时", hard: false },
  {
    text: "the decision which was expected last week",
    type: "object",
    note: "宾语，含定语从句",
    hard: false,
  },
  {
    text: "which was expected last week",
    type: "clause",
    note: "定语从句，修饰 decision",
    hard: false,
  },
  { text: "which", type: "subject", note: "关系代词作主语", hard: false },
  { text: "was expected", type: "predicate", note: "被动语态", hard: false },
  { text: "last week", type: "adverbial", note: "时间状语", hard: false },
  {
    text: "citing concerns that the proposal, if implemented hastily, could undermine public trust",
    type: "adverbial",
    note: "现在分词作状语",
    hard: true,
  },
  {
    text: "that the proposal, if implemented hastily, could undermine public trust",
    type: "clause",
    note: "同位语从句，说明 concerns",
    hard: true,
  },
  { text: "that", type: "connector", note: "引导同位语从句", hard: false },
  {
    text: "the proposal, if implemented hastily,",
    type: "subject",
    note: "主语，含插入条件",
    hard: false,
  },
  { text: "if implemented hastily", type: "clause", note: "条件状语从句，省略主语", hard: true },
  { text: "if", type: "connector", note: "引导条件状语从句", hard: false },
  { text: "implemented", type: "predicate", note: "过去分词，被动", hard: false },
  { text: "hastily", type: "adverbial", note: "方式状语", hard: false },
  { text: "could undermine", type: "predicate", note: "情态动词+动词", hard: false },
  { text: "public trust", type: "object", note: "宾语", hard: false },
]

const SENTENCE_ANALYSIS_SAMPLE_VALUES: Record<SentenceAnalysisSlot, string> = {
  // Compact, like the model wrote it.
  annotations: JSON.stringify(SENTENCE_ANALYSIS_SAMPLE_ANNOTATIONS),
  translation:
    "委员会推迟了原定于上周做出的决定，理由是担心该提案如果仓促实施，可能会损害公众信任。",
  structure:
    "主句为“The committee has postponed the decision”，后接which引导的定语从句修饰decision，现在分词短语citing concerns作伴随状语，其中that引导同位语从句解释concerns，同位语从句内又含if引导的条件状语从句。",
}

export const LAYOUT_SAMPLE_NUMBER = 3

// The selection and target language the preview renders with: those of the
// sentence-analysis sample, or of the UI language's dictionary sample.
export function getLayoutSampleContext(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  locale?: string,
): { selection: string; targetLanguage: string } {
  if (isSentenceAnalysisShaped(outputSchema)) {
    return {
      selection: SENTENCE_ANALYSIS_SAMPLE_SELECTION,
      targetLanguage: SENTENCE_ANALYSIS_SAMPLE_TARGET_LANGUAGE,
    }
  }
  const { selection, targetLanguage } = dictionarySampleFor(locale)
  return { selection, targetLanguage }
}

export interface LayoutSampleOptions {
  // The UI language, which picks the dictionary sample; defaults to the
  // default UI language.
  locale?: string
  // Text for a string field with no curated sample; defaults to the name.
  placeholder?: (field: SelectionToolbarCustomActionOutputField) => string
  // Edited samples by field id. Kept as typed text: a number field's text is
  // converted (or kept as written when not numeric) by the layout scope, like
  // a model answer would be.
  overrides?: Readonly<Record<string, string>>
}

export function buildLayoutSampleValues(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  options: LayoutSampleOptions = {},
): Record<string, string | number> {
  // Curated text by field id, for the fields a generated card places.
  const curatedByFieldId = new Map<string, string>()
  const dictionarySample = dictionarySampleFor(options.locale)
  for (const [slot, field] of Object.entries(getDictionarySlots(outputSchema))) {
    if (field) curatedByFieldId.set(field.id, dictionarySample.values[slot as DictionarySlot])
  }
  for (const [slot, field] of Object.entries(getSentenceAnalysisSlots(outputSchema))) {
    if (field) {
      curatedByFieldId.set(field.id, SENTENCE_ANALYSIS_SAMPLE_VALUES[slot as SentenceAnalysisSlot])
    }
  }

  const values: Record<string, string | number> = {}
  for (const field of outputSchema) {
    const override = options.overrides?.[field.id]
    const curated = curatedByFieldId.get(field.id)
    let value: string | number
    if (override !== undefined) value = override
    else if (field.type === "number") value = LAYOUT_SAMPLE_NUMBER
    else if (curated !== undefined) value = curated
    else value = options.placeholder?.(field) ?? field.name
    // defineProperty: a field named `__proto__` must stay an own key.
    Object.defineProperty(values, field.name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return values
}

// The partial results a stream would deliver on the way to `values`: fields
// arrive in schema order, strings grow a chunk at a time (never splitting a
// surrogate pair), and every frame extends the one before it. Starts with {}
// (everything pending) and ends with the complete values.
export function buildStreamingFrames(
  values: Readonly<Record<string, unknown>>,
  outputSchema: SelectionToolbarCustomActionOutputField[],
  options: { maxFrames?: number } = {},
): Array<Record<string, unknown>> {
  const entries: Array<[name: string, value: unknown]> = []
  const seen = new Set<string>()
  for (const field of outputSchema) {
    if (seen.has(field.name) || !Object.hasOwn(values, field.name)) continue
    seen.add(field.name)
    entries.push([field.name, values[field.name]])
  }

  const totalChars = entries.reduce(
    (sum, [, value]) => sum + (typeof value === "string" ? Array.from(value).length : 0),
    0,
  )
  const step = Math.max(1, Math.ceil(totalChars / Math.max(1, options.maxFrames ?? 60)))

  const frames: Array<Record<string, unknown>> = [{}]
  let current: Record<string, unknown> = {}
  const push = (name: string, value: unknown) => {
    current = { ...current }
    Object.defineProperty(current, name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
    frames.push(current)
  }

  for (const [name, value] of entries) {
    if (typeof value !== "string" || value === "") {
      push(name, value)
      continue
    }
    const chars = Array.from(value)
    for (let end = step; ; end += step) {
      push(name, chars.slice(0, Math.min(end, chars.length)).join(""))
      if (end >= chars.length) break
    }
  }
  return frames
}
