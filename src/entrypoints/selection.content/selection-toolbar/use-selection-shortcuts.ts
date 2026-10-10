import type { Hotkey } from "@tanstack/hotkeys"
import type { SelectionSession } from "./atoms"
import { matchesKeyboardEvent } from "@tanstack/hotkeys"
import { useAtomValue } from "jotai"
import { useEffect, useEffectEvent } from "react"
import { SELECTION_SHORTCUT_CLAIMED_EVENT } from "@/utils/constants/selection"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"
import { shadowWrapper } from ".."
import { buildContextSnapshot, readSelectionSnapshot } from "../utils"
import { createSelectionSession, selectionSessionAtom } from "./atoms"

function isEditable(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

// Whether a node is in the extension's own UI, through any shadow root nested
// in it (a custom action's card renders in one).
function isInOwnUi(node: Node | null) {
  const ownRoot = shadowWrapper?.getRootNode()
  let current = node
  while (current) {
    const root = current.getRootNode()
    if (root === ownRoot) {
      return true
    }
    current = root instanceof ShadowRoot ? root.host : null
  }
  return false
}

// Typing in a field of the extension's own UI (a dialog over the page, say):
// the page's selection is still held there, but the keys are the user's text.
// The field can sit in a shadow root nested in that UI (a custom action's
// card), where the root's own activeElement is only the nested host.
function isTypingInOwnUi() {
  const root = shadowWrapper?.getRootNode()
  if (!(root instanceof ShadowRoot)) {
    return false
  }
  let focused = root.activeElement
  while (focused?.shadowRoot?.activeElement) {
    focused = focused.shadowRoot.activeElement
  }
  return isEditable(focused)
}

// The page's selection as it is when the key is pressed. The toolbar records one only on
// mouseup, so a selection made or changed with the keyboard (Shift+Arrow, Ctrl+A) is read
// here. A selection in the extension's own UI is not the page's: null.
function readLiveSelectionSession(): SelectionSession | null {
  const selection = window.getSelection()
  if (isInOwnUi(selection?.anchorNode ?? null)) {
    return null
  }
  const snapshot = readSelectionSnapshot(selection)
  return snapshot ? createSelectionSession(snapshot, buildContextSnapshot(snapshot)) : null
}

/**
 * Binds keys to commands on the current selection, as `{ [id]: shortcut }`; `run` gets the id
 * of the key pressed and the selection to act on, and says whether it did anything.
 *
 * A key claims the keystroke only when its command ran: with nothing selected (or the command
 * switched off) the page gets the key as if Read Frog had no shortcut on it, which keeps a
 * clash with a site's own shortcut to the moments the user meant ours. The keys also work in
 * the page's text fields — a selection made there is one to act on too (Improve Writing is
 * mostly used on it) — but not in the extension's own.
 *
 * The selection is the one on the page when the key is pressed, however it was made; when
 * there is none (the toolbar's own popup took the focus, say), the one the toolbar last
 * recorded.
 *
 * The listener is on `window` in the capture phase, ahead of the page's own: a claimed key
 * never reaches an editor's handler on the field, its ancestors or `document`. A held key's
 * repeats follow its first press: a claimed key's are kept from the page too but run nothing
 * (holding it does not toggle reading over and over), a key left to the page stays the page's.
 */
export function useSelectionShortcuts(
  shortcuts: Record<string, string | undefined>,
  run: (id: string, session: SelectionSession | null) => boolean,
) {
  const recordedSession = useAtomValue(selectionSessionAtom)
  const onRun = useEffectEvent((id: string) =>
    run(id, readLiveSelectionSession() ?? recordedSession),
  )
  const bindings = Object.entries(shortcuts).filter(
    (entry): entry is [string, string] => !isShortcutEmpty(entry[1]) && isValidShortcut(entry[1]!),
  )
  const bindingsKey = JSON.stringify(bindings)

  useEffect(() => {
    const keyBindings = JSON.parse(bindingsKey) as [string, string][]
    if (keyBindings.length === 0) {
      return undefined
    }

    // The key the last press claimed, while it is held.
    let claimed: { code: string; shortcut: string } | null = null

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.repeat) {
        if (
          claimed &&
          event.code === claimed.code &&
          matchesKeyboardEvent(event, claimed.shortcut as Hotkey)
        ) {
          event.preventDefault()
          event.stopImmediatePropagation()
        }
        return
      }
      claimed = null
      if (isTypingInOwnUi()) {
        return
      }
      const binding = keyBindings.find(([, shortcut]) =>
        matchesKeyboardEvent(event, shortcut as Hotkey),
      )
      if (!binding || !onRun(binding[0])) {
        return
      }
      claimed = { code: event.code, shortcut: binding[1] }
      event.preventDefault()
      event.stopImmediatePropagation()
      // The key no longer reaches the paragraph hotkey's listener: tell it.
      window.dispatchEvent(new Event(SELECTION_SHORTCUT_CLAIMED_EVENT))
    }

    const handleKeyup = (event: KeyboardEvent) => {
      if (event.code === claimed?.code) {
        claimed = null
      }
    }

    window.addEventListener("keydown", handleKeydown, { capture: true })
    window.addEventListener("keyup", handleKeyup, { capture: true })
    return () => {
      window.removeEventListener("keydown", handleKeydown, { capture: true })
      window.removeEventListener("keyup", handleKeyup, { capture: true })
    }
  }, [bindingsKey])
}
