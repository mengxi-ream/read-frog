import type { Hotkey } from "@tanstack/hotkeys"
import { HotkeyManager } from "@tanstack/hotkeys"
import { useEffect, useEffectEvent } from "react"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"
import { shadowWrapper } from ".."

function isEditable(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

// Typing in a field of the extension's own UI (a dialog over the page, say):
// the page's selection is still held there, but the keys are the user's text.
function isTypingInOwnUi() {
  const root = shadowWrapper?.getRootNode()
  return root instanceof ShadowRoot && isEditable(root.activeElement)
}

/**
 * Binds keys to commands on the current selection, as `{ [id]: shortcut }`; `run` gets the id
 * of the key pressed and says whether it did anything.
 *
 * A key claims the keystroke only when its command ran: with nothing selected (or the command
 * switched off) the page gets the key as if Read Frog had no shortcut on it, which keeps a
 * clash with a site's own shortcut to the moments the user meant ours. The keys also work in
 * the page's text fields — a selection made there is one to act on too (Improve Writing is
 * mostly used on it) — but not in the extension's own.
 */
export function useSelectionShortcuts(
  shortcuts: Record<string, string | undefined>,
  run: (id: string) => boolean,
) {
  const onRun = useEffectEvent(run)
  const bindings = Object.entries(shortcuts).filter(
    (entry): entry is [string, string] => !isShortcutEmpty(entry[1]) && isValidShortcut(entry[1]!),
  )
  const bindingsKey = JSON.stringify(bindings)

  useEffect(() => {
    const registrations = (JSON.parse(bindingsKey) as [string, string][]).map(([id, shortcut]) =>
      HotkeyManager.getInstance().register(
        shortcut as Hotkey,
        (event) => {
          if (isTypingInOwnUi() || !onRun(id)) {
            return
          }
          event.preventDefault()
          event.stopPropagation()
        },
        {
          ignoreInputs: false,
          preventDefault: false,
          stopPropagation: false,
          // The options page turns down a key another shortcut has; one saved before that
          // check runs both, which is no reason to warn on every page.
          conflictBehavior: "allow",
        },
      ),
    )

    return () => {
      registrations.forEach((registration) => registration.unregister())
    }
  }, [bindingsKey])
}
