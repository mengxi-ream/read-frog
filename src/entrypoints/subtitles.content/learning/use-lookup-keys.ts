import type { WordToken } from "@/utils/subtitles/segment-words"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { isEditable } from "@/utils/host/dom/filter"
import { displaySubtitleAtom } from "../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "./atoms"

const SELECTION_TOOLBAR_HOST_TAG = "read-frog-selection"
const PAGE_CONTROL_SELECTOR =
  "select, [role=slider], [role=spinbutton], [role=listbox], [role=menu], [role=menuitem], [role=tab], [role=combobox]"

/** Keys typed into Read Frog's own UI, such as the card's menus, are theirs. */
function isFromExtensionUi(event: KeyboardEvent) {
  return event
    .composedPath()
    .some(
      (node) =>
        node instanceof Element &&
        (node.tagName.toLowerCase() === SELECTION_TOOLBAR_HOST_TAG ||
          node.classList.contains(REACT_SHADOW_HOST_CLASS)),
    )
}

/** Keys typed into a field or a control on the page, such as a slider, are the page's. */
function isFromPageControl(event: KeyboardEvent) {
  const origin = event.composedPath()[0]
  return (
    origin instanceof HTMLElement &&
    (isEditable(origin) || origin.closest(PAGE_CONTROL_SELECTOR) !== null)
  )
}

function getNeighborWord(tokens: WordToken[], from: number, step: -1 | 1) {
  for (let index = from + step; index >= 0 && index < tokens.length; index += step) {
    if (tokens[index]?.isWord) {
      return index
    }
  }
  return null
}

function claim(event: KeyboardEvent) {
  event.preventDefault()
  // Ahead of the page: YouTube reads Escape as "leave theater mode" and the
  // arrow keys as seeking.
  event.stopImmediatePropagation()
}

/**
 * While a lookup is open, Escape closes it and ←/→ step a one-word lookup to
 * the next word in the line. Keys the lookup has no use for stay with the page.
 */
export function useLookupKeys() {
  const lookup = useAtomValue(wordLookupAtom)
  const tokens = useAtomValue(subtitleTokensAtom)
  const cue = useAtomValue(displaySubtitleAtom)
  const lookUp = useSetAtom(lookUpAtom)

  useEffect(() => {
    if (!lookup) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isFromExtensionUi(event) ||
        isFromPageControl(event)
      ) {
        return
      }

      if (event.key === "Escape") {
        claim(event)
        lookUp(null)
        return
      }

      const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : null
      const stepping =
        step !== null && lookup.start === lookup.end && lookup.cueStart === cue?.start
      if (!stepping) {
        return
      }

      claim(event)
      const next = event.repeat ? null : getNeighborWord(tokens, lookup.start, step)
      if (next !== null) {
        lookUp({ start: next, end: next })
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [cue, lookUp, lookup, tokens])
}
