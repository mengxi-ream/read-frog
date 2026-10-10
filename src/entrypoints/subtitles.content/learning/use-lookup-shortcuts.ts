import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { isEditable } from "@/utils/host/dom/filter"
import { shiftWordLookupAtom, wordLookupAtom } from "./atoms"

export function useLookupShortcuts() {
  const open = useAtomValue(wordLookupAtom) !== null
  const shift = useSetAtom(shiftWordLookupAtom)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof HTMLElement && isEditable(event.target))
      ) {
        return
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        event.stopPropagation()
        shift(event.key === "ArrowLeft" ? -1 : 1)
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [open, shift])
}
