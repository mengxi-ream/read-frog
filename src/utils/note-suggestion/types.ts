import { HOSTED_AI_NOTE_SUGGESTION_MAX_NOTES } from "@read-frog/api-contract"
import { z } from "zod"

// The BYOK envelope diverged from the hosted noteSuggestion contract on
// purpose (flat summaryFieldName, no action object), but the note budget is a
// product decision shared with the hosted endpoint.
export const NOTE_SUGGESTION_MAX_NOTES = HOSTED_AI_NOTE_SUGGESTION_MAX_NOTES

export const noteSuggestionNoteFieldSchema = z.strictObject({
  name: z.string(),
  value: z.union([z.string(), z.number()]).nullable(),
})

export const noteSuggestionNoteSchema = z.strictObject({
  fields: z.array(noteSuggestionNoteFieldSchema),
})

/**
 * Client-owned structured-output schema of the note suggestion, passed to
 * `Output.object` when streaming from the user's selection-translate LLM
 * provider (the nested shape cannot go through the flat structured-object
 * port schema).
 */
export const noteSuggestionEnvelopeSchema = z.strictObject({
  /**
   * Display hint: which schema field's value best explains the term in one
   * line. Optional for tolerance of models that omit the field entirely.
   */
  summaryFieldName: z.string().nullable().optional(),
  notes: z.array(noteSuggestionNoteSchema).max(NOTE_SUGGESTION_MAX_NOTES),
})

export type NoteSuggestionEnvelope = z.infer<typeof noteSuggestionEnvelopeSchema>
export type NoteSuggestionNote = z.infer<typeof noteSuggestionNoteSchema>

export type NoteSuggestionNoteRecord = Record<string, string | number | null>

export interface ValidatedNoteSuggestion {
  /** Notes keyed by output-field name, validated against the selected action's schema. */
  notes: NoteSuggestionNoteRecord[]
  /**
   * Sanitized display hint: a non-primary field name of the target action
   * whose value best explains the term, or null (fall back to schema order).
   */
  summaryFieldName: string | null
}
