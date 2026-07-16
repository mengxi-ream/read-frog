import type { SelectionToolbarCustomActionPromptTokens } from "../custom-action-prompt"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { SAVE_SUGGESTION_MAX_NOTES } from "@/utils/save-suggestion/types"
import { buildStructuredOutputFieldList } from "../custom-action-prompt"

// The hosted note-suggestion endpoint rejects prompts above 32k characters.
// Cap the page-derived free text, cap each candidate field description, and
// keep total headroom below the hard limit so a valid request is always sent.
const SAVE_SUGGESTION_MAX_SELECTION_CHARS = 1500
const SAVE_SUGGESTION_MAX_PARAGRAPHS_CHARS = 2500
const SAVE_SUGGESTION_MAX_WEB_TITLE_CHARS = 200
const SAVE_SUGGESTION_MAX_FIELD_DESCRIPTION_CHARS = 300
// User-prompt budget, comfortably under the endpoint's 32000-char hard limit.
const SAVE_SUGGESTION_MAX_PROMPT_CHARS = 30000

function truncateForPrompt(text: string, maxChars: number): string {
  const trimmed = text.trim()
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed
}

/**
 * Clone an action with each output-field description capped, so a candidate with
 * very long descriptions cannot alone blow the prompt budget. Only used for the
 * save-suggestion prompt — the shared field formatter is left untouched.
 */
function capActionFieldDescriptions(
  action: SelectionToolbarCustomAction,
): SelectionToolbarCustomAction {
  return {
    ...action,
    outputSchema: action.outputSchema.map((field) => ({
      ...field,
      description: truncateForPrompt(
        field.description,
        SAVE_SUGGESTION_MAX_FIELD_DESCRIPTION_CHARS,
      ),
    })),
  }
}

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

const SAVE_SUGGESTION_SYSTEM_PROMPT = `You are a vocabulary note assistant for a language-learning browser extension. The user reads foreign-language web pages and translates selections into their own language (the target language). They are learning the language the selected text is written in. Identify the words or phrases from the selected text that are the most valuable for them to save into their vocabulary notebook, and produce notes for them.

## Structured Output Contract
Return exactly one JSON object and nothing else, with this shape:
{
  "action": {
    "createNewDictionaryAction": boolean,
    "targetActionId": string or null,
    "summaryFieldName": string or null
  },
  "notes": [
    { "fields": [ { "name": string, "value": string or number or null } ] }
  ]
}

### Choosing the action
1. The user prompt lists candidate note actions, each with an id, a name, and a field schema.
2. Pick the single candidate that fits dictionary/vocabulary notes best: set "targetActionId" to its id and "createNewDictionaryAction" to false.
3. Only when no candidate fits vocabulary notes at all (or no candidates exist), set "createNewDictionaryAction" to true and "targetActionId" to null, and use the Default Dictionary Schema from the user prompt for the notes instead.
4. Set "summaryFieldName" to the name of one field from the chosen schema whose value best explains the first field's term in one line (usually a definition or meaning field). Use null if no field fits.

### Producing notes
1. Return 1 or ${SAVE_SUGGESTION_MAX_NOTES} notes covering only the most valuable words or phrases from the selected text, in the selected text's original language. Prefer returning at least 1. Return an empty "notes" array only if truly nothing is worth saving.
2. Each note's "fields" must contain exactly one entry per field of the chosen schema, in the schema's order.
3. Each entry's "name" must exactly match a schema field key. Never invent field names.
4. Each entry's "value" must match the field's declared type ("string" or "number"); use null when unknown.
5. Follow each field's description when writing its value.
6. Values describe the term itself: a phonetic field transcribes the term in the term's own language (e.g., IPA for English, pinyin for Mandarin), never its translation. Explanatory fields such as definitions are written in the target language unless their description says otherwise.

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
  const selection = truncateForPrompt(input.selection, SAVE_SUGGESTION_MAX_SELECTION_CHARS)
  const paragraphs = truncateForPrompt(input.paragraphs, SAVE_SUGGESTION_MAX_PARAGRAPHS_CHARS)
  const webTitle = truncateForPrompt(input.webTitle, SAVE_SUGGESTION_MAX_WEB_TITLE_CHARS)
  const tokens: SelectionToolbarCustomActionPromptTokens = {
    selection,
    paragraphs,
    targetLanguage: input.targetLanguage,
    webTitle,
    webContent: "",
  }

  const dictionaryBlock = buildStructuredOutputFieldList(input.dictionaryDraft.outputSchema, tokens)
  const cappedCandidates = input.candidates.map(capActionFieldDescriptions)

  const assemble = (candidates: SelectionToolbarCustomAction[]) => {
    const candidatesBlock =
      candidates.length > 0
        ? candidates.map((action) => formatCandidateAction(action, tokens)).join("\n")
        : "None."

    return `## Web Page Title
${webTitle}

## Selected Text
${selection}

## Surrounding Paragraphs
${paragraphs}

## Target Language
${input.targetLanguage}

## Candidate Actions
${candidatesBlock}

## Default Dictionary Schema (only when "createNewDictionaryAction" is true)
${dictionaryBlock}`
  }

  // Drop candidate actions from the end until within budget. A dropped action is
  // simply not offered as a target (the model falls back to createNewDictionaryAction),
  // which degrades gracefully instead of sending an over-limit request that fails
  // and suppresses suggestions for the whole page session.
  let candidates = cappedCandidates
  let prompt = assemble(candidates)
  while (prompt.length > SAVE_SUGGESTION_MAX_PROMPT_CHARS && candidates.length > 0) {
    candidates = candidates.slice(0, -1)
    prompt = assemble(candidates)
  }

  return { systemPrompt: SAVE_SUGGESTION_SYSTEM_PROMPT, prompt }
}
