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
5. Phonetic must use the standard notation for the term's language (e.g., IPA for English, pinyin for Mandarin, romaji for Japanese).
6. Part of Speech in English (noun, verb, adjective, etc.).
7. Difficulty must be a CEFR level (A1, A2, B1, B2, C1, or C2).
8. If a field is unknown, return an empty string instead of guessing.
9. Respond in {{targetLang}} for all textual fields unless source-form text is required for clarity.

## Examples

### Example 1
Input: Selection="blossoms", Context="The ephemeral beauty of cherry blossoms reminds us to cherish each moment.", Target language=Chinese

Output:
- Term: blossom
- Phonetic: /ˈblɒs.əm/
- Part of Speech: noun
- Context: The ephemeral beauty of cherry blossoms reminds us to cherish each moment.
- Definition: 花；花朵（尤指果树的花）
- Context Translation: 樱花短暂的美丽提醒我们珍惜每一刻。
- Difficulty: B2

### Example 2
Input: Selection="感動", Context="この映画はつまらないと思ったけど、最後は感動した。", Target language=English

Output:
- Term: 感動
- Phonetic: kandou
- Part of Speech: noun
- Context: この映画はつまらないと思ったけど、最後は感動した。
- Definition: Being deeply moved; emotional touch
- Context Translation: I thought this movie was boring, but the ending was moving.
- Difficulty: B1`,
  prompt: `## Input
Selection: {{selection}}
Context: {{context}}
Target language: {{targetLang}}`,
  outputSchema: [
    { id: "default-dictionary-term", name: "Term", type: "string" as const, description: "Base/canonical lemma of the selected term." },
    { id: "default-dictionary-phonetic", name: "Phonetic", type: "string" as const, description: "Standard phonetic transcription for the term's language (e.g., IPA for English, pinyin for Mandarin, romaji for Japanese)." },
    { id: "default-dictionary-pos", name: "Part of Speech", type: "string" as const, description: "Grammatical category (e.g., noun, verb, adjective)." },
    { id: "default-dictionary-context", name: "Context", type: "string" as const, description: "The context in the prompt above, don't change it." },
    { id: "default-dictionary-definition", name: "Definition", type: "string" as const, description: "One concise definition for the contextual sense." },
    { id: "default-dictionary-context-translation", name: "Context Translation", type: "string" as const, description: "The translation of the context." },
    { id: "default-dictionary-difficulty", name: "Difficulty", type: "string" as const, description: "Estimated CEFR difficulty level: A1, A2, B1, B2, C1, or C2." },
  ],
} satisfies SelectionToolbarCustomFeature

export const SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS = ["selection", "context", "targetLang", "title"] as const

export type SelectionToolbarCustomFeatureToken = (typeof SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS)[number]

export function getSelectionToolbarCustomFeatureTokenCellText(token: SelectionToolbarCustomFeatureToken) {
  return `{{${token}}}`
}
