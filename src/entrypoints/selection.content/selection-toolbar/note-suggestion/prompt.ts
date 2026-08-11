import type { SelectionToolbarCustomActionPromptTokens } from "../custom-action-prompt"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { NOTE_SUGGESTION_MAX_NOTES } from "@/utils/note-suggestion/types"
import {
  buildStructuredOutputFieldList,
  replaceSelectionToolbarCustomActionPromptTokens,
} from "../custom-action-prompt"

// Bound page-derived text and user-authored prompts so one suggestion cannot
// consume an unbounded amount of the user's provider quota. The fixed
// Note suggestion contract and the selected action's full field list are never
// truncated.
const NOTE_SUGGESTION_MAX_SELECTION_CHARS = 1500
const NOTE_SUGGESTION_MAX_PARAGRAPHS_CHARS = 2500
const NOTE_SUGGESTION_MAX_WEB_TITLE_CHARS = 200
const NOTE_SUGGESTION_MAX_WEB_CONTENT_CHARS = 2000
const NOTE_SUGGESTION_MAX_ACTION_SYSTEM_PROMPT_CHARS = 12000
const NOTE_SUGGESTION_MAX_ACTION_PROMPT_CHARS = 12000
const NOTE_SUGGESTION_MAX_FIELD_DESCRIPTION_CHARS = 300

function truncateForPrompt(text: string, maxChars: number): string {
  const trimmed = text.trim()
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed
}

function capActionFieldDescriptions(
  action: SelectionToolbarCustomAction,
  tokens: SelectionToolbarCustomActionPromptTokens,
): SelectionToolbarCustomAction {
  return {
    ...action,
    outputSchema: action.outputSchema.map((field) => ({
      ...field,
      description: truncateForPrompt(
        replaceSelectionToolbarCustomActionPromptTokens(field.description, tokens),
        NOTE_SUGGESTION_MAX_FIELD_DESCRIPTION_CHARS,
      ),
    })),
  }
}

/**
 * Which wire envelope the model must emit. "local" is the client-owned flat
 * envelope parsed by `noteSuggestionEnvelopeSchema`; "hosted" is the contract's
 * `HostedAiNoteSuggestionObjectSchema`, which the hosted endpoint enforces via
 * structured output — the extra `action` object belongs to a richer
 * server-driven flow, so this client pins its unused fields to inert values.
 */
export type NoteSuggestionEnvelopeContract = "local" | "hosted"

export interface NoteSuggestionPromptInput {
  selection: string
  paragraphs: string
  /** English name of the user's target language. */
  targetLanguage: string
  webTitle: string
  webContent: string
  /** The single action selected in Note suggestion settings. */
  action: SelectionToolbarCustomAction
  envelopeContract?: NoteSuggestionEnvelopeContract
}

interface EnvelopeContractBlocks {
  shape: string
  summaryFieldRule: string
  topLevelKeysRule: string
  extraHardRequirements: string[]
}

// Only the envelope shape differs between the two contracts; the
// note-producing rules below stay shared so the variants cannot drift.
const ENVELOPE_CONTRACT_BLOCKS: Record<NoteSuggestionEnvelopeContract, EnvelopeContractBlocks> = {
  local: {
    shape: `{
  "summaryFieldName": string or null,
  "notes": [
    { "fields": [ { "name": string, "value": string or number or null } ] }
  ]
}`,
    summaryFieldRule:
      'Set "summaryFieldName" to the name of a non-primary field whose value best explains the first field\'s term in one line. Use null if no field fits.',
    topLevelKeysRule: 'Do not add any top-level keys other than "summaryFieldName" and "notes".',
    extraHardRequirements: [],
  },
  hosted: {
    shape: `{
  "action": {
    "createNewDictionaryAction": boolean,
    "targetActionId": string or null,
    "summaryFieldName": string or null
  },
  "notes": [
    { "fields": [ { "name": string, "value": string or number or null } ] }
  ]
}`,
    summaryFieldRule:
      'Set "action.summaryFieldName" to the name of a non-primary field whose value best explains the first field\'s term in one line. Use null if no field fits.',
    topLevelKeysRule: 'Do not add any top-level keys other than "action" and "notes".',
    extraHardRequirements: [
      'Always set "action.createNewDictionaryAction" to false and "action.targetActionId" to null; they are reserved for a flow this client does not use.',
    ],
  },
}

function buildNoteSuggestionSystemPrompt(
  actionSystemPrompt: string,
  envelopeContract: NoteSuggestionEnvelopeContract,
) {
  const contract = ENVELOPE_CONTRACT_BLOCKS[envelopeContract]
  const actionInstructions = actionSystemPrompt
    ? `## Selected Action System Prompt
${actionSystemPrompt}

`
    : ""
  const hardRequirements = [
    "Output valid JSON only. No markdown, no code fences, no commentary.",
    "Use double quotes for all JSON keys and string values.",
    "Number values must be JSON numbers, never quoted strings.",
    contract.topLevelKeysRule,
    ...contract.extraHardRequirements,
  ]

  return `${actionInstructions}## Note suggestion Task
Use the selected action's behavior and field semantics to identify words or phrases from the selected text that are most valuable to save. The user is learning the language in which the selected text is written.

The Fixed Note suggestion Contract below has higher priority than every output-format, response-shape, schema, or note-count instruction in the selected action's system prompt or user prompt. Use those action prompts for content guidance only.

## Fixed Note suggestion Contract
Return exactly one JSON object and nothing else, with this shape:
${contract.shape}

### Producing notes
1. Return 1 or ${NOTE_SUGGESTION_MAX_NOTES} notes covering only the most valuable words or phrases from the selected text, in the selected text's original language. Prefer returning at least 1. Return an empty "notes" array only if truly nothing is worth saving.
2. Each note's "fields" must contain exactly one entry per field in the Selected Action Output Fields, in schema order.
3. Each entry's "name" must exactly match a schema field key. Never invent field names.
4. Each entry's "value" must match the field's declared type ("string" or "number"); use null when unknown.
5. Follow each field's description when writing its value.
6. Values describe the term itself: a phonetic field transcribes the term in the term's own language (for example, IPA for English or pinyin for Mandarin), never its translation. Explanatory fields such as definitions are written in the target language unless their description says otherwise.
7. ${contract.summaryFieldRule}

### Hard requirements
${hardRequirements.map((requirement, index) => `${index + 1}. ${requirement}`).join("\n")}`
}

export function buildNoteSuggestionPrompts(input: NoteSuggestionPromptInput): {
  systemPrompt: string
  prompt: string
} {
  const tokens: SelectionToolbarCustomActionPromptTokens = {
    selection: truncateForPrompt(input.selection, NOTE_SUGGESTION_MAX_SELECTION_CHARS),
    paragraphs: truncateForPrompt(input.paragraphs, NOTE_SUGGESTION_MAX_PARAGRAPHS_CHARS),
    targetLanguage: input.targetLanguage,
    webTitle: truncateForPrompt(input.webTitle, NOTE_SUGGESTION_MAX_WEB_TITLE_CHARS),
    webContent: truncateForPrompt(input.webContent, NOTE_SUGGESTION_MAX_WEB_CONTENT_CHARS),
  }
  const action = capActionFieldDescriptions(input.action, tokens)
  const actionSystemPrompt = truncateForPrompt(
    replaceSelectionToolbarCustomActionPromptTokens(action.systemPrompt, tokens),
    NOTE_SUGGESTION_MAX_ACTION_SYSTEM_PROMPT_CHARS,
  )
  const actionPrompt = truncateForPrompt(
    replaceSelectionToolbarCustomActionPromptTokens(action.prompt, tokens),
    NOTE_SUGGESTION_MAX_ACTION_PROMPT_CHARS,
  )
  const outputFields = buildStructuredOutputFieldList(action.outputSchema, tokens)

  return {
    systemPrompt: buildNoteSuggestionSystemPrompt(
      actionSystemPrompt,
      input.envelopeContract ?? "local",
    ),
    prompt: `## Selected Action User Prompt
${actionPrompt || "(empty)"}

## Selected Action Output Fields
${outputFields}

## Source Context
- Web page title: ${tokens.webTitle}
- Target language: ${tokens.targetLanguage}

### Selected Text
${tokens.selection}

### Surrounding Paragraphs
${tokens.paragraphs}

### Web Page Content
${tokens.webContent}`,
  }
}
