import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { displaySubtitleAtom } from "../atoms"
import { clearWordSelectionAtom, wordSelectionAtom } from "./atoms"

const SELECTION_TOOLBAR_HOST_TAG = "read-frog-selection"

export function useWordSelectionDismiss() {
  const selection = useAtomValue(wordSelectionAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const clearSelection = useSetAtom(clearWordSelectionAtom)
  const active = selection !== null

  useEffect(() => {
    if (!active) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      const onToolbar = event
        .composedPath()
        .some(
          (node) =>
            node instanceof Element && node.tagName.toLowerCase() === SELECTION_TOOLBAR_HOST_TAG,
        )
      if (!onToolbar) {
        clearSelection()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [active, clearSelection])

  useEffect(() => {
    if (selection && cue?.start !== selection.cueStart) {
      clearSelection()
    }
  }, [clearSelection, cue?.start, selection])
}
