import type {
  SelectionToolbarCustomFeature,
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

export const DEFAULT_DICTIONARY_FEATURE = {
  id: "default-dictionary",
  name: "Dictionary",
  enabled: true,
  icon: "tabler:book-2",
  providerId: "openai-default",
  systemPrompt: "You are a dictionary assistant for language learners. Given a term and its surrounding context, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLang}}.",
  prompt: "Term: {{selection}}\nContext: {{context}}\nTarget language: {{targetLang}}",
  outputSchema: [
    { id: "default-dictionary-term", name: "Term", type: "string" as const },
    { id: "default-dictionary-definition", name: "Definition", type: "string" as const },
    { id: "default-dictionary-context", name: "Context", type: "string" as const },
    { id: "default-dictionary-examples", name: "Examples", type: "string" as const },
    { id: "default-dictionary-synonyms", name: "Synonyms", type: "string" as const },
    { id: "default-dictionary-antonyms", name: "Antonyms", type: "string" as const },
  ],
} satisfies SelectionToolbarCustomFeature

export const SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS = ["selection", "context", "targetLang", "title"] as const

export type SelectionToolbarCustomFeatureToken = (typeof SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS)[number]

export function getSelectionToolbarCustomFeatureTokenCellText(token: SelectionToolbarCustomFeatureToken) {
  return `{{${token}}}`
}
