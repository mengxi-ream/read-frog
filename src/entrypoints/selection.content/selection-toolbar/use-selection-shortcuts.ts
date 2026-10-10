import type { Hotkey } from "@tanstack/hotkeys"
import { matchesKeyboardEvent } from "@tanstack/hotkeys"
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
 *
 * The listener is on `window` in the capture phase, ahead of the page's own: a claimed key
 * never reaches an editor's handler on the field, its ancestors or `document`. A held key's
 * repeats run nothing, so holding it does not toggle reading over and over.
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
    const keyBindings = JSON.parse(bindingsKey) as [string, string][]
    if (keyBindings.length === 0) {
      return undefined
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingInOwnUi()) {
        return
      }
      const binding = keyBindings.find(([, shortcut]) =>
        matchesKeyboardEvent(event, shortcut as Hotkey),
      )
      if (!binding || !onRun(binding[0])) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    window.addEventListener("keydown", handleKeydown, { capture: true })
    return () => {
      window.removeEventListener("keydown", handleKeydown, { capture: true })
    }
  }, [bindingsKey])
}
