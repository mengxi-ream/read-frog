import type {
  DictionarySlot,
  SentenceAnalysisLayoutLabels,
  SentenceAnalysisSlot,
} from "@read-frog/layout-engine/presets"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import {
  buildDictionaryLayout,
  buildSentenceAnalysisLayout,
} from "@read-frog/layout-engine/presets"

// Which output fields of a custom action fill the slots of a generated card.
// Slots are recognized by the field ids the presets create, which copies of
// an action keep; field names are localized and editable, so they never
// decide anything here.
//
// Bundled into every entrypoint through the config constants: only the
// dependency-free `contract` and `presets` subpaths may be imported here.

type Field = SelectionToolbarCustomActionOutputField

// `dictionary-*` (the Dictionary preset) and `default-dictionary-*` (the
// built-in Dictionary, and copies of it). Anchored at the end so `…-context`
// never claims `…-context-translation` or `…-context-term`.
const DICTIONARY_SLOT_ID_RE =
  /(?:^|-)dictionary-(term|phonetic|part-of-speech|definition|context-translation|context-term|context|difficulty)$/

const DICTIONARY_SLOT_BY_ID_SUFFIX: Record<string, DictionarySlot> = {
  term: "term",
  phonetic: "phonetic",
  "part-of-speech": "partOfSpeech",
  definition: "definition",
  context: "context",
  "context-term": "contextTerm",
  "context-translation": "contextTranslation",
  difficulty: "difficulty",
}

// `sentence-analysis-*` from the Sentence Analysis preset (copies keep the
// ids), anchored at the end like the dictionary's.
const SENTENCE_ANALYSIS_SLOT_ID_RE = /(?:^|-)sentence-analysis-(annotations|translation|structure)$/

export function getDictionarySlots(
  outputSchema: readonly Field[],
): Partial<Record<DictionarySlot, Field>> {
  const slots: Partial<Record<DictionarySlot, Field>> = {}
  for (const field of outputSchema) {
    const suffix = DICTIONARY_SLOT_ID_RE.exec(field.id)?.[1]
    const slot = suffix === undefined ? undefined : DICTIONARY_SLOT_BY_ID_SUFFIX[suffix]
    // First match wins; a second field claiming the same slot stays in the tail.
    if (slot && !slots[slot]) slots[slot] = field
  }
  return slots
}

export function isDictionaryShaped(outputSchema: readonly Field[]): boolean {
  const slots = getDictionarySlots(outputSchema)
  return Boolean(slots.term && slots.definition)
}

export function getSentenceAnalysisSlots(
  outputSchema: readonly Field[],
): Partial<Record<SentenceAnalysisSlot, Field>> {
  const slots: Partial<Record<SentenceAnalysisSlot, Field>> = {}
  for (const field of outputSchema) {
    const slot = SENTENCE_ANALYSIS_SLOT_ID_RE.exec(field.id)?.[1] as
      | SentenceAnalysisSlot
      | undefined
    // First match wins; a second field claiming the same slot stays in the tail.
    if (slot && !slots[slot]) slots[slot] = field
  }
  return slots
}

export function isSentenceAnalysisShaped(outputSchema: readonly Field[]): boolean {
  return getSentenceAnalysisSlots(outputSchema).annotations !== undefined
}

function slotIds<S extends string>(slots: Partial<Record<S, Field>>): Partial<Record<S, string>> {
  const ids: Partial<Record<S, string>> = {}
  for (const [slot, field] of Object.entries(slots) as Array<[S, Field | undefined]>) {
    if (field) ids[slot] = field.id
  }
  return ids
}

// The dictionary card for this action's fields, or null when it has no term
// or no definition field.
export function buildDictionaryActionLayout(outputSchema: readonly Field[]): string | null {
  return buildDictionaryLayout({ slots: slotIds(getDictionarySlots(outputSchema)) })
}

// The sentence analysis card for this action's fields, annotating and
// speaking the selection; null when it has no annotations field.
export function buildSentenceAnalysisActionLayout(
  outputSchema: readonly Field[],
  labels: SentenceAnalysisLayoutLabels,
): string | null {
  return buildSentenceAnalysisLayout({
    slots: slotIds(getSentenceAnalysisSlots(outputSchema)),
    labels,
    source: { ctxKey: "selection" },
  })
}
