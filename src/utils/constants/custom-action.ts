import type {
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionOutputType,
} from "@/types/config/selection-toolbar"
import { getUniqueName } from "@/utils/name"

export const ICON_PATTERN = /^[^:\s]+:[^:\s]+$/
export const DEFAULT_ACTION_NAME = "Custom AI Action"
export function createOutputSchemaField(
  name: string,
  type: SelectionToolbarCustomActionOutputType = "string",
  description = "",
  id?: string,
): SelectionToolbarCustomActionOutputField {
  return {
    id: id ?? crypto.randomUUID(),
    name,
    type,
    description,
  }
}

export function getNextOutputFieldName(fields: SelectionToolbarCustomActionOutputField[], prefix: string): string {
  const existingNames = new Set(fields.map(f => f.name))
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
  return fields.some(field =>
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

export const SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS = ["selection", "context", "targetLang", "title"] as const

export type SelectionToolbarCustomActionToken = (typeof SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS)[number]

export function getSelectionToolbarCustomActionTokenCellText(token: SelectionToolbarCustomActionToken) {
  return `{{${token}}}`
}
