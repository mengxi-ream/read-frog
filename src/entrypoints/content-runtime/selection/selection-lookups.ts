import type { SelectionSession } from "./selection-toolbar/atoms"

// A selection was looked up: translated, or an AI action run on it. Difficult
// words listens, to count a lookup of a word in a paragraph it judged.

type Listener = (session: SelectionSession) => void

const listeners = new Set<Listener>()

export function notifySelectionLookup(session: SelectionSession | null) {
  if (!session) return
  for (const listener of listeners) listener(session)
}

export function onSelectionLookup(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
