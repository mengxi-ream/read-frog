import type {
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionOutputType,
} from "@/types/config/selection-toolbar"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { getUniqueName } from "@/utils/name"

export const ICON_PATTERN = /^[^:\s]+:[^:\s]+$/
export const DEFAULT_ACTION_NAME = "Custom AI Action"
export const BUILT_IN_DICTIONARY_ACTION_ID = "default-dictionary"
export const BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID = "default-sentence-analysis"
export const BUILT_IN_IMPROVE_WRITING_ACTION_ID = "default-improve-writing"

// The code-owned actions, by id → their key in `selectionToolbar.builtInActions`,
// which persists only their enabled/provider/Notebase state. Listed in the
// order they appear in, ahead of the user's own actions.
export const BUILT_IN_ACTION_KEYS = {
  [BUILT_IN_DICTIONARY_ACTION_ID]: "dictionary",
  [BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID]: "sentenceAnalysis",
  [BUILT_IN_IMPROVE_WRITING_ACTION_ID]: "improveWriting",
} as const

export type BuiltInActionId = keyof typeof BUILT_IN_ACTION_KEYS
export type BuiltInActionKey = (typeof BUILT_IN_ACTION_KEYS)[BuiltInActionId]

export const BUILT_IN_ACTION_IDS = Object.keys(BUILT_IN_ACTION_KEYS) as BuiltInActionId[]

export function isBuiltInActionId(id: string): id is BuiltInActionId {
  return Object.hasOwn(BUILT_IN_ACTION_KEYS, id)
}

export function createOutputSchemaField(
  name: string,
  type: SelectionToolbarCustomActionOutputType = "string",
  description = "",
  id?: string,
): SelectionToolbarCustomActionOutputField {
  return {
    id: id ?? getRandomUUID(),
    name,
    type,
    description,
  }
}

export function getNextOutputFieldName(
  fields: SelectionToolbarCustomActionOutputField[],
  prefix: string,
): string {
  const existingNames = new Set(fields.map((f) => f.name))
  existingNames.add(prefix)
  return getUniqueName(prefix, existingNames, "")
}

export function normalizeOutputSchemaFieldName(name: string) {
  return name.trim()
}

export function isOutputSchemaFieldNameBlank(name: string) {
  return normalizeOutputSchemaFieldName(name).length === 0
}

export function isDuplicateOutputSchemaFieldName(
  name: string,
  fields: SelectionToolbarCustomActionOutputField[],
  currentFieldId?: string,
) {
  const normalizedName = normalizeOutputSchemaFieldName(name)
  return fields.some(
    (field) =>
      field.id !== currentFieldId && normalizeOutputSchemaFieldName(field.name) === normalizedName,
  )
}

export function getOutputSchemaFieldNameError(
  name: string,
  fields: SelectionToolbarCustomActionOutputField[],
  currentFieldId?: string,
): "blank" | "duplicate" | undefined {
  if (isOutputSchemaFieldNameBlank(name)) {
    return "blank"
  }

  if (isDuplicateOutputSchemaFieldName(name, fields, currentFieldId)) {
    return "duplicate"
  }

  return undefined
}

export const SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS = [
  "selection",
  "paragraphs",
  "targetLanguage",
  "webTitle",
  "webUrl",
  "webContent",
] as const

export type SelectionToolbarCustomActionToken =
  (typeof SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS)[number]

export function getSelectionToolbarCustomActionTokenCellText(
  token: SelectionToolbarCustomActionToken,
) {
  return `{{${token}}}`
}
