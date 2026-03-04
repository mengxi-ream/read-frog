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
  systemPrompt: `You are a dictionary assistant for language learners.

## Goal
Given a term and its surrounding context, produce a concise dictionary entry that matches the required output object.

## Rules
1. Focus on the meaning that best matches the provided context.
2. Normalize Term to its base/canonical form.
3. Keep Definition precise and learner-friendly.
4. Keep Context short and directly tied to the selected text.
5. Examples should be natural and use the same sense as the context.
6. Synonyms and Antonyms should match the same sense.
7. If a field is unknown, return an empty string instead of guessing.
8. Respond in {{targetLang}} for all textual fields unless source-form text is required for clarity.`,
  prompt: `## Input
Selection: {{selection}}
Context: {{context}}
Target language: {{targetLang}}

## Field Guidance
- Term: Base/canonical lemma of the selected term.
- Context: The context in the prompt above, don't change it.
- Definition: One concise definition for the contextual sense.
- Context Translation: The translation of the context.

## Examples

### Example 1
Input: Selection="blossoms", Context="The ephemeral beauty of cherry blossoms reminds us to cherish each moment.", Target language=Chinese

Output:
- Term: blossom
- Context: The ephemeral beauty of cherry blossoms reminds us to cherish each moment.
- Definition: 花；花朵（尤指果树的花）
- Context Translation: 樱花短暂的美丽提醒我们珍惜每一刻。

### Example 2
Input: Selection="つまらない", Context="この映画はつまらないと思ったけど、最後は感動した。", Target language=English

Output:
- Term: つまらない
- Context: この映画はつまらないと思ったけど、最後は感動した。
- Definition: Boring; dull; uninteresting
- Context Translation: I thought this movie was boring, but the ending was moving.
`,
  outputSchema: [
    { id: "default-dictionary-term", name: "Term", type: "string" as const },
    { id: "default-dictionary-context", name: "Context", type: "string" as const },
    { id: "default-dictionary-definition", name: "Definition", type: "string" as const },
    { id: "default-dictionary-context-translation", name: "Context Translation", type: "string" as const },
  ],
} satisfies SelectionToolbarCustomFeature

export const SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS = ["selection", "context", "targetLang", "title"] as const

export type SelectionToolbarCustomFeatureToken = (typeof SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS)[number]

export function getSelectionToolbarCustomFeatureTokenCellText(token: SelectionToolbarCustomFeatureToken) {
  return `{{${token}}}`
}
