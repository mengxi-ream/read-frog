import { useAtomValue } from "jotai"
import { useCallback, useState } from "react"
import { selectionContentAtom, selectionRangeAtom } from "./atoms"

interface SelectionPopoverSnapshot {
  selectionContentSnapshot: string | null
  selectionRangeSnapshot: Range | null
}

function createEmptySnapshot(): SelectionPopoverSnapshot {
  return {
    selectionContentSnapshot: null,
    selectionRangeSnapshot: null,
  }
}

export function useSelectionPopoverSnapshot() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const selectionRange = useAtomValue(selectionRangeAtom)
  const [snapshot, setSnapshot] = useState<SelectionPopoverSnapshot>(createEmptySnapshot)
  const [popoverSessionKey, setPopoverSessionKey] = useState(0)

  const captureSelectionSnapshot = useCallback(() => {
    setSnapshot({
      selectionContentSnapshot: selectionContent,
      selectionRangeSnapshot: selectionRange?.cloneRange() ?? null,
    })
    setPopoverSessionKey(prev => prev + 1)
  }, [selectionContent, selectionRange])

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
