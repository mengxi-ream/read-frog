import type { SelectionToolbarCustomFeatureOutputField } from "@/types/config/selection-toolbar"
import { getSelectionToolbarCustomFeatureTokenCellText } from "@/utils/constants/selection-toolbar-custom-feature"

export interface SelectionToolbarCustomFeaturePromptTokens {
  selection: string
  context: string
  targetLang: string
  title: string
}

export function replaceSelectionToolbarCustomFeaturePromptTokens(
  prompt: string,
  tokens: SelectionToolbarCustomFeaturePromptTokens,
) {
  return prompt
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("selection"), tokens.selection)
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("context"), tokens.context)
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("targetLang"), tokens.targetLang)
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("title"), tokens.title)
}

type StructuredOutputField = Pick<SelectionToolbarCustomFeatureOutputField, "name" | "type" | "description">

function buildStructuredOutputContract(outputSchema: StructuredOutputField[]) {
  const fieldsAndTypes = outputSchema
    .map((field) => {
      const base = `- ${JSON.stringify(field.name)}: ${field.type} (nullable)`
      return field.description ? `${base} — ${field.description}` : base
    })
    .join("\n")

  return `## Structured Output Contract
Return exactly one JSON object and nothing else.

### Required Keys and Types
${fieldsAndTypes}

### Hard Requirements
1. Include every required key exactly once.
2. Do not add any extra keys.
3. Use the exact key names shown above.
4. Output valid JSON only. Use double quotes for keys and string values.
5. Do not wrap the JSON in markdown or code fences.
6. If a value is unknown, use fallback defaults: string -> "", number -> 0.
7. Number fields must be JSON numbers, never quoted strings.
`
}

export function buildSelectionToolbarCustomFeatureSystemPrompt(
  prompt: string,
  tokens: SelectionToolbarCustomFeaturePromptTokens,
  outputSchema: StructuredOutputField[],
) {
  const resolvedPrompt = replaceSelectionToolbarCustomFeaturePromptTokens(prompt, tokens).trim()
  const contract = buildStructuredOutputContract(outputSchema)

  return resolvedPrompt
    ? `${resolvedPrompt}\n\n${contract}`
    : contract
}
