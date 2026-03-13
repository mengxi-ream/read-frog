import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { getSelectionToolbarCustomActionTokenCellText } from "@/utils/constants/custom-action"

export interface SelectionToolbarCustomActionPromptTokens {
  selection: string
  context: string
  targetLang: string
  title: string
}

export function replaceSelectionToolbarCustomActionPromptTokens(
  prompt: string,
  tokens: SelectionToolbarCustomActionPromptTokens,
) {
  return prompt
    .replaceAll(getSelectionToolbarCustomActionTokenCellText("selection"), tokens.selection)
    .replaceAll(getSelectionToolbarCustomActionTokenCellText("context"), tokens.context)
    .replaceAll(getSelectionToolbarCustomActionTokenCellText("targetLang"), tokens.targetLang)
    .replaceAll(getSelectionToolbarCustomActionTokenCellText("title"), tokens.title)
}

type StructuredOutputField = Pick<SelectionToolbarCustomActionOutputField, "name" | "type" | "description">

function formatYamlMultiline(value: string) {
  return value
    .split("\n")
    .map(line => `    ${line}`)
    .join("\n")
}

function formatStructuredOutputField(
  field: StructuredOutputField,
  tokens: SelectionToolbarCustomActionPromptTokens,
) {
  const resolvedDescription = replaceSelectionToolbarCustomActionPromptTokens(field.description, tokens).trim()
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
  tokens: SelectionToolbarCustomActionPromptTokens,
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

export function buildSelectionToolbarCustomActionSystemPrompt(
  prompt: string,
  tokens: SelectionToolbarCustomActionPromptTokens,
  outputSchema: StructuredOutputField[],
) {
  const resolvedPrompt = replaceSelectionToolbarCustomActionPromptTokens(prompt, tokens).trim()
  const contract = buildStructuredOutputContract(outputSchema, tokens)

  return resolvedPrompt
    ? `${resolvedPrompt}\n\n${contract}`
    : contract
}
