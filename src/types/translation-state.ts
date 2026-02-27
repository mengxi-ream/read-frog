import { z } from "zod"

export const translationStateSchema = z.object({
  enabled: z.boolean(),
})

export type TranslationState = z.infer<typeof translationStateSchema>
