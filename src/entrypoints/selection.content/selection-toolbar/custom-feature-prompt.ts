import type { SelectionToolbarCustomFeatureOutputField } from "@/types/config/selection-toolbar"
import { getSelectionToolbarCustomFeatureTokenCellText } from "@/utils/constants/custom-feature"

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

function formatYamlMultiline(value: string) {
  return value
    .split("\n")
    .map(line => `    ${line}`)
    .join("\n")
}

function formatStructuredOutputField(
  field: StructuredOutputField,
  tokens: SelectionToolbarCustomFeaturePromptTokens,
) {
  const resolvedDescription = replaceSelectionToolbarCustomFeaturePromptTokens(field.description, tokens).trim()
  const descriptionBlock = resolvedDescription
    ? `  description: |-\n${formatYamlMultiline(resolvedDescription)}`
    : "  description: \"\""

  return [
    `- key: ${JSON.stringify(field.name)}`,
    `  type: ${field.type}`,
    "  nullable: true",
    descriptionBlock,
  ].join("\n")
}

function buildStructuredOutputContract(
  outputSchema: StructuredOutputField[],
  tokens: SelectionToolbarCustomFeaturePromptTokens,
) {
  const fieldsAndTypes = outputSchema
    .map(field => formatStructuredOutputField(field, tokens))
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
6. If a value is unknown, use null.
7. Number fields must be JSON numbers, never quoted strings.
`
}

export function buildSelectionToolbarCustomFeatureSystemPrompt(
  prompt: string,
  tokens: SelectionToolbarCustomFeaturePromptTokens,
  outputSchema: StructuredOutputField[],
) {
  const resolvedPrompt = replaceSelectionToolbarCustomFeaturePromptTokens(prompt, tokens).trim()
  const contract = buildStructuredOutputContract(outputSchema, tokens)

  return resolvedPrompt
    ? `${resolvedPrompt}\n\n${contract}`
    : contract
}
