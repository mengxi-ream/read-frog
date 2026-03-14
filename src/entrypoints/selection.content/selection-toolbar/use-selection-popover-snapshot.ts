import type { ContextSnapshot, SelectionSnapshot } from "../utils"
import { useAtomValue } from "jotai"
import { useCallback, useState } from "react"
import { contextAtom, selectionAtom } from "./atoms"

interface SelectionPopoverSnapshot {
  selectionSnapshot: SelectionSnapshot | null
  contextSnapshot: ContextSnapshot | null
}

function createEmptySnapshot(): SelectionPopoverSnapshot {
  return {
    selectionSnapshot: null,
    contextSnapshot: null,
  }
}

function cloneSelectionSnapshot(snapshot: SelectionSnapshot | null): SelectionSnapshot | null {
  if (!snapshot) {
    return null
  }

  return {
    ...snapshot,
    ranges: snapshot.ranges.map(range => ({ ...range })),
  }
}

function cloneContextSnapshot(snapshot: ContextSnapshot | null): ContextSnapshot | null {
  if (!snapshot) {
    return null
  }

  return {
    ...snapshot,
    paragraphs: [...snapshot.paragraphs],
  }
}

export function useSelectionPopoverSnapshot() {
  const selection = useAtomValue(selectionAtom)
  const context = useAtomValue(contextAtom)
  const [snapshot, setSnapshot] = useState<SelectionPopoverSnapshot>(createEmptySnapshot)
  const [popoverSessionKey, setPopoverSessionKey] = useState(0)

  const captureSelectionSnapshot = useCallback(() => {
    setSnapshot({
      selectionSnapshot: cloneSelectionSnapshot(selection),
      contextSnapshot: cloneContextSnapshot(context),
    })
    setPopoverSessionKey(prev => prev + 1)
  }, [context, selection])

  const clearSelectionSnapshot = useCallback(() => {
    setSnapshot(createEmptySnapshot())
  }, [])

  return {
    ...snapshot,
    popoverSessionKey,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  }
}
