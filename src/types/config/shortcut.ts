import { z } from "zod"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

// Every recorded key combination in the config. Empty means no key.
export const shortcutSchema = z.string().superRefine((shortcut, ctx) => {
  if (isShortcutEmpty(shortcut)) {
    return
  }

  if (!isValidShortcut(shortcut)) {
    ctx.addIssue({
      code: "custom",
      message: "A shortcut must include at least one modifier key and one non-modifier key.",
    })
  }
})
