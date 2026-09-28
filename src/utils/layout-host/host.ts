import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { LayoutScope } from "@read-frog/layout-engine/core"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { defineLayoutHost } from "@read-frog/layout-engine/contract"
import { buildLayoutScope } from "@read-frog/layout-engine/core"
import { MAX_CUSTOM_ACTION_LAYOUT_LENGTH } from "@/types/config/selection-toolbar"
import { contentLocaleFor, getImproveWritingLabels, getSentenceAnalysisLabels } from "./labels"
import { IMPROVE_WRITING_LABELS_CTX_KEY, SENTENCE_ANALYSIS_LABELS_CTX_KEY } from "./slots"

// What custom actions tell the layout engine about themselves: layouts read
// output fields by name (`{{ ["Term"] }}`, and renaming a field rewrites its
// references), and `ctx` carries the selected text, the target language, and
// the sentence analysis and Improve Writing cards' words in that language,
// next to the built-in `fields` and `status`. These ctx keys are part of every saved layout: add
// new ones, never rename or remove one.
export function createCustomActionLayoutHost(maxSourceLength = MAX_CUSTOM_ACTION_LAYOUT_LENGTH) {
  return defineLayoutHost({
    id: "extension.custom-action",
    ctxKeys: [
      "selection",
      "targetLanguage",
      SENTENCE_ANALYSIS_LABELS_CTX_KEY,
      IMPROVE_WRITING_LABELS_CTX_KEY,
    ],
    ctxKeyKinds: {
      selection: "string",
      targetLanguage: "string",
      [SENTENCE_ANALYSIS_LABELS_CTX_KEY]: "object",
      [IMPROVE_WRITING_LABELS_CTX_KEY]: "object",
    },
    scopeKey: "name",
    maxSourceLength,
  })
}

export const CUSTOM_ACTION_LAYOUT_HOST = createCustomActionLayoutHost()

export interface CustomActionLayoutScopeInput {
  outputSchema: readonly SelectionToolbarCustomActionOutputField[]
  value: Readonly<Record<string, unknown>> | null
  selection: string
  // The language the answer was asked in (`language.targetCode` of the run):
  // `ctx.targetLanguage` names it as the prompt did, and the card's own words
  // follow it (see contentLocaleFor).
  targetCode: LangCodeISO6393
  status: LayoutStatus
}

// The data a custom action's layout renders: the (possibly partial) answer
// keyed by field name, plus ctx.
export function buildCustomActionLayoutScope({
  outputSchema,
  value,
  selection,
  targetCode,
  status,
}: CustomActionLayoutScopeInput): LayoutScope {
  return buildLayoutScope({
    host: CUSTOM_ACTION_LAYOUT_HOST,
    fields: outputSchema,
    values: value,
    ctx: {
      selection,
      targetLanguage: LANG_CODE_TO_EN_NAME[targetCode],
      [SENTENCE_ANALYSIS_LABELS_CTX_KEY]: getSentenceAnalysisLabels(contentLocaleFor(targetCode)),
      [IMPROVE_WRITING_LABELS_CTX_KEY]: getImproveWritingLabels(contentLocaleFor(targetCode)),
    },
    status,
  })
}
