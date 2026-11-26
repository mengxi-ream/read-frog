import { z } from "zod"

/**
 * What the user set for one Built-in AI model, keyed by the model's id in the
 * server's catalog.
 *
 * `reasoning` is the level picked in the model's reasoning control; missing
 * means the model's own default. A plain string rather than the contract's
 * level enum: a level a newer server offers must not make a stored config fail
 * to parse, which would reset every setting. Requests only ever send a level
 * that this client knows and the model takes.
 */
const builtInAiModelSettingsSchema = z.object({
  reasoning: z.string().min(1).max(32).optional(),
})

// `.default()` lets a config stored before v127 parse in UI contexts that load
// ahead of the background migration.
export const builtInAiConfigSchema = z
  .object({
    models: z.record(z.string().min(1).max(64), builtInAiModelSettingsSchema),
  })
  .default(() => ({ models: {} }))

export type BuiltInAiConfig = z.infer<typeof builtInAiConfigSchema>
