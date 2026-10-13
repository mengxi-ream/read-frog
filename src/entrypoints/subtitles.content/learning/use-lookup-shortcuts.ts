import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { closeWordLookupAtom, shiftWordLookupAtom, wordLookupAtom } from "./atoms"
import { isFromEditable, isFromPage } from "./page-events"

function isPlainArrow(event: KeyboardEvent) {
  return (
    (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}

export function useLookupShortcuts() {
  const open = useAtomValue(wordLookupAtom) !== null
  const shift = useSetAtom(shiftWordLookupAtom)
  const closeLookup = useSetAtom(closeWordLookupAtom)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isFromPage(event) || isFromEditable(event)) {
        return
      }
      if (isPlainArrow(event)) {
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) {
          shift(event.key === "ArrowLeft" ? -1 : 1)
        }
      }
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        closeLookup()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [closeLookup, open, shift])
}
