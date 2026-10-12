import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { isEditable } from "@/utils/host/dom/filter"
import { closeWordLookupAtom, shiftWordLookupAtom, wordLookupAtom } from "./atoms"
import { isFromPage } from "./page-events"

export function useLookupShortcuts() {
  const open = useAtomValue(wordLookupAtom) !== null
  const shift = useSetAtom(shiftWordLookupAtom)
  const closeLookup = useSetAtom(closeWordLookupAtom)

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
      if (event.key === "Escape" && isFromPage(event)) {
        event.preventDefault()
        event.stopPropagation()
        closeLookup()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [closeLookup, open, shift])
}
