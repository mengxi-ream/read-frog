import type {
  SelectionToolbarCustomFeatureOutputField,
  SelectionToolbarCustomFeatureOutputType,
} from "@/types/config/selection-toolbar"

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
): SelectionToolbarCustomFeatureOutputField {
  return {
    id: crypto.randomUUID(),
    name,
    type,
  }
}

export function getNextOutputFieldName(fields: SelectionToolbarCustomFeatureOutputField[], prefix: string): string {
  const existingNameSet = new Set(fields.map(field => field.name))
  for (let i = 1; i <= fields.length + 1; i++) {
    const candidate = `${prefix}${i}`
    if (!existingNameSet.has(candidate)) {
      return candidate
    }
  }
  return `${prefix}${fields.length + 1}`
}

export const SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS = ["selection", "context"] as const

export type SelectionToolbarCustomFeatureToken = (typeof SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS)[number]

export function getSelectionToolbarCustomFeatureTokenCellText(token: SelectionToolbarCustomFeatureToken) {
  return `{{${token}}}`
}
