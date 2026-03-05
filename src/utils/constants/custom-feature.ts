import type {
  SelectionToolbarCustomFeatureOutputField,
  SelectionToolbarCustomFeatureOutputType,
} from "@/types/config/selection-toolbar"
import { getUniqueName } from "@/utils/name"

export const ICON_PATTERN = /^[^:\s]+:[^:\s]+$/
export const DEFAULT_FEATURE_NAME = "Custom AI Feature"
export const DEFAULT_FEATURE_ICONS = [
  "tabler:sparkles",
  "tabler:bulb",
  "tabler:book-2",
  "tabler:brain",
  "tabler:wand",
] as const

export function createOutputSchemaField(
  name: string,
  type: SelectionToolbarCustomFeatureOutputType = "string",
  description = "",
): SelectionToolbarCustomFeatureOutputField {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    description,
  }
}

export function getNextOutputFieldName(fields: SelectionToolbarCustomFeatureOutputField[], prefix: string): string {
  const existingNames = new Set(fields.map(f => f.name))
  existingNames.add(prefix)
  return getUniqueName(prefix, existingNames, "")
}

export const SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS = ["selection", "context", "targetLang", "title"] as const

export type SelectionToolbarCustomFeatureToken = (typeof SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS)[number]

export function getSelectionToolbarCustomFeatureTokenCellText(token: SelectionToolbarCustomFeatureToken) {
  return `{{${token}}}`
}
