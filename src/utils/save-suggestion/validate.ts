import type { SaveSuggestionNote, SaveSuggestionNoteRecord, ValidatedSaveSuggestion } from "./types"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { createStructuredObjectSchema } from "@/utils/ai/structured-object-schema"

/**
 * Convert a note's name/value pairs into a record keyed by output-field name:
 * unknown field names are dropped, missing fields become null, and the first
 * occurrence wins for duplicated names.
 */
export function notePairsToRecord(
  note: SaveSuggestionNote,
  outputSchema: SelectionToolbarCustomActionOutputField[],
): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const field of outputSchema) {
    record[field.name] = null
  }

  const seenNames = new Set<string>()
  for (const pair of note.fields) {
    if (!(pair.name in record) || seenNames.has(pair.name)) {
      continue
    }
    seenNames.add(pair.name)
    record[pair.name] = pair.value
  }

  return record
}

export interface ValidateSaveSuggestionInput {
  envelope: {
    action: {
      createNewDictionaryAction: boolean
      targetActionId: string | null
      summaryFieldName?: string | null
    }
    notes: SaveSuggestionNote[]
  }
  /** Enabled custom actions snapshot taken when the request was fired. */
  candidates: SelectionToolbarCustomAction[]
  /** Dictionary action draft created when the request was fired. */
  dictionaryDraft: SelectionToolbarCustomAction
}

/**
 * Sanitize the AI's display hint: it must name a non-primary field of the
 * chosen action, otherwise fall back to null (schema-order display). A bad
 * hint is cosmetic and never discards the suggestion.
 */
function sanitizeSummaryFieldName(
  summaryFieldName: string | null | undefined,
  outputSchema: SelectionToolbarCustomActionOutputField[],
): string | null {
  if (!summaryFieldName) {
    return null
  }

  const isNonPrimaryField = outputSchema.some(
    (field, index) => index > 0 && field.name === summaryFieldName,
  )
  return isNonPrimaryField ? summaryFieldName : null
}

/**
 * All-or-nothing validation of the AI suggestion: an invalid action choice,
 * zero notes, any note failing the target action's output schema, or an empty
 * primary display field discards the whole suggestion (returns null, meaning
 * "treat it as never happened").
 */
export function validateSaveSuggestion(
  input: ValidateSaveSuggestionInput,
): ValidatedSaveSuggestion | null {
  const { envelope, candidates, dictionaryDraft } = input

  const createNew = envelope.action.createNewDictionaryAction
  const action = createNew
    ? dictionaryDraft
    : envelope.action.targetActionId !== null
      ? candidates.find((candidate) => candidate.id === envelope.action.targetActionId)
      : undefined
  if (!action) {
    return null
  }

  if (envelope.notes.length === 0) {
    return null
  }

  const primaryFieldName = action.outputSchema[0]?.name
  if (!primaryFieldName) {
    return null
  }

  const noteSchema = createStructuredObjectSchema(
    action.outputSchema.map(({ name, type }) => ({ name, type })),
  )

  const notes: SaveSuggestionNoteRecord[] = []
  for (const note of envelope.notes) {
    const parsed = noteSchema.safeParse(notePairsToRecord(note, action.outputSchema))
    if (!parsed.success) {
      return null
    }

    const record = parsed.data as SaveSuggestionNoteRecord
    const primaryValue = record[primaryFieldName]
    const hasPrimaryValue =
      typeof primaryValue === "string" ? primaryValue.trim().length > 0 : primaryValue !== null
    if (!hasPrimaryValue) {
      return null
    }

    notes.push(record)
  }

  return {
    target: createNew ? { kind: "create_dictionary" } : { kind: "existing", actionId: action.id },
    notes,
    summaryFieldName: sanitizeSummaryFieldName(
      envelope.action.summaryFieldName,
      action.outputSchema,
    ),
  }
}
