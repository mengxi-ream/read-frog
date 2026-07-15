import { z } from "zod"

export const SAVE_SUGGESTION_MAX_NOTES = 2

export const saveSuggestionNoteFieldSchema = z.strictObject({
  name: z.string(),
  value: z.union([z.string(), z.number()]).nullable(),
})

export const saveSuggestionNoteSchema = z.strictObject({
  fields: z.array(saveSuggestionNoteFieldSchema),
})

/**
 * Mirrors the fixed server-side structured-output schema of
 * `hostedAi.noteSuggestion.streamStructuredObject`
 * (HostedAiNoteSuggestionObjectSchema in @read-frog/api-contract).
 */
export const saveSuggestionEnvelopeSchema = z.strictObject({
  action: z.strictObject({
    createNewDictionaryAction: z.boolean(),
    targetActionId: z.string().nullable(),
  }),
  notes: z.array(saveSuggestionNoteSchema).max(SAVE_SUGGESTION_MAX_NOTES),
})

export type SaveSuggestionEnvelope = z.infer<typeof saveSuggestionEnvelopeSchema>
export type SaveSuggestionNote = z.infer<typeof saveSuggestionNoteSchema>

export type SaveSuggestionTarget =
  | { kind: "existing"; actionId: string }
  | { kind: "create_dictionary" }

export type SaveSuggestionNoteRecord = Record<string, string | number | null>

export interface ValidatedSaveSuggestion {
  target: SaveSuggestionTarget
  /** Notes keyed by output-field name, validated against the target action's schema. */
  notes: SaveSuggestionNoteRecord[]
}
