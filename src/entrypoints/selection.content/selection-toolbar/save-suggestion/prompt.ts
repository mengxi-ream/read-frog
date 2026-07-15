import type { SelectionToolbarCustomActionPromptTokens } from "../custom-action-prompt"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { SAVE_SUGGESTION_MAX_NOTES } from "@/utils/save-suggestion/types"
import { buildStructuredOutputFieldList } from "../custom-action-prompt"

export interface SaveSuggestionPromptInput {
  selection: string
  paragraphs: string
  /** English name of the user's target language. */
  targetLanguage: string
  webTitle: string
  /** Enabled custom actions offered to the model as candidates. */
  candidates: SelectionToolbarCustomAction[]
  /** Dictionary draft whose schema applies when createNewDictionaryAction is true. */
  dictionaryDraft: SelectionToolbarCustomAction
}

const SAVE_SUGGESTION_SYSTEM_PROMPT = `You are a vocabulary note assistant for a language-learning browser extension. The user just requested a translation of text they selected on a web page. Identify the words or phrases from the selected text that are the most valuable for the user to save into their vocabulary notebook, and produce notes for them.

## Structured Output Contract
Return exactly one JSON object and nothing else, with this shape:
{
  "action": {
    "createNewDictionaryAction": boolean,
    "targetActionId": string or null
  },
  "notes": [
    { "fields": [ { "name": string, "value": string or number or null } ] }
  ]
}

### Choosing the action
1. The user prompt lists candidate note actions, each with an id, a name, and a field schema.
2. Pick the single candidate that fits dictionary/vocabulary notes best: set "targetActionId" to its id and "createNewDictionaryAction" to false.
3. Only when no candidate fits vocabulary notes at all (or no candidates exist), set "createNewDictionaryAction" to true and "targetActionId" to null, and use the Default Dictionary Schema from the user prompt for the notes instead.

### Producing notes
1. Return 1 or ${SAVE_SUGGESTION_MAX_NOTES} notes covering only the most valuable words or phrases from the selected text for a learner of the target language. Prefer returning at least 1. Return an empty "notes" array only if truly nothing is worth saving.
2. Each note's "fields" must contain exactly one entry per field of the chosen schema, in the schema's order.
3. Each entry's "name" must exactly match a schema field key. Never invent field names.
4. Each entry's "value" must match the field's declared type ("string" or "number"); use null when unknown.
5. Follow each field's description when writing its value.

### Hard requirements
1. Output valid JSON only. No markdown, no code fences, no commentary.
2. Use double quotes for all JSON keys and string values.
3. Number values must be JSON numbers, never quoted strings.`

function formatCandidateAction(
  action: SelectionToolbarCustomAction,
  tokens: SelectionToolbarCustomActionPromptTokens,
) {
  return [
    `- id: ${JSON.stringify(action.id)}`,
    `  name: ${JSON.stringify(action.name)}`,
    "  fields:",
    buildStructuredOutputFieldList(action.outputSchema, tokens)
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
  ].join("\n")
}

export function buildSaveSuggestionPrompts(input: SaveSuggestionPromptInput): {
  systemPrompt: string
  prompt: string
} {
  const tokens: SelectionToolbarCustomActionPromptTokens = {
    selection: input.selection,
    paragraphs: input.paragraphs,
    targetLanguage: input.targetLanguage,
    webTitle: input.webTitle,
    webContent: "",
  }

  const candidatesBlock =
    input.candidates.length > 0
      ? input.candidates.map((action) => formatCandidateAction(action, tokens)).join("\n")
      : "None."

  const prompt = `## Web Page Title
${input.webTitle}

## Selected Text
${input.selection}

## Surrounding Paragraphs
${input.paragraphs}

## Target Language
${input.targetLanguage}

## Candidate Actions
${candidatesBlock}

## Default Dictionary Schema (only when "createNewDictionaryAction" is true)
${buildStructuredOutputFieldList(input.dictionaryDraft.outputSchema, tokens)}`

  return { systemPrompt: SAVE_SUGGESTION_SYSTEM_PROMPT, prompt }
}
