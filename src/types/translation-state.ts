import { z } from "zod"

export const translationStateSchema = z.object({
  enabled: z.boolean(),
  origin: z.string().optional(),
  // Set when the user manually turned translation off (popup, floating
  // button, shortcut, touch gesture, context menu). Scoped by `origin`;
  // auto-translation must not force the page back on while this is set.
  userDisabled: z.boolean().optional(),
})

export type TranslationState = z.infer<typeof translationStateSchema>
