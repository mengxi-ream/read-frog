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
  key: string = "result",
  type: SelectionToolbarCustomFeatureOutputType = "string",
): SelectionToolbarCustomFeatureOutputField {
  return {
    id: crypto.randomUUID(),
    key,
    type,
  }
}

export function getNextOutputFieldKey(fields: SelectionToolbarCustomFeatureOutputField[]): string {
  const existingKeySet = new Set(fields.map(field => field.key))
  for (let i = 1; i <= fields.length + 1; i++) {
    const candidate = `field_${i}`
    if (!existingKeySet.has(candidate)) {
      return candidate
    }
  }
  return `field_${fields.length + 1}`
}

export const SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS = ["selection", "context"] as const

export type SelectionToolbarCustomFeatureToken = (typeof SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS)[number]

export function getSelectionToolbarCustomFeatureTokenCellText(token: SelectionToolbarCustomFeatureToken) {
  return `{{${token}}}`
}
