import type { HotkeyChord } from "@tanstack/hotkeys"
import { HotkeyManager } from "@tanstack/hotkeys"
import { useEffect, useEffectEvent } from "react"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

/**
 * Annotation mode's own key, `onPress` on each press. A key for the page, not
 * the selection: it needs nothing selected and works with the toolbar closed,
 * like the translation mode key. Typing in a text field keeps the keystroke,
 * as there is nothing to annotate there; a held key toggles once, not on
 * every repeat. Without a key (undefined, or cleared), nothing is bound.
 */
export function useAnnotationModeShortcut(shortcut: string | undefined, onPress: () => void) {
  const handlePress = useEffectEvent(onPress)

  useEffect(() => {
    if (isShortcutEmpty(shortcut) || !isValidShortcut(shortcut!)) {
      return undefined
    }
    const registration = HotkeyManager.getInstance().register(
      shortcut as HotkeyChord,
      () => handlePress(),
      {
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
        requireReset: true,
      },
    )
    return () => registration.unregister()
  }, [shortcut])
}
