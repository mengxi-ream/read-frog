import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { isEditable } from "@/utils/host/dom/filter"

const SELECTION_TOOLBAR_HOST_TAG = "read-frog-selection"

function isExtensionUiHost(node: EventTarget) {
  return (
    node instanceof Element &&
    (node.tagName.toLowerCase() === SELECTION_TOOLBAR_HOST_TAG ||
      node.classList.contains(REACT_SHADOW_HOST_CLASS))
  )
}

export function isFromPage(event: Event) {
  return !event.composedPath().some(isExtensionUiHost)
}

export function isFromEditable(event: Event) {
  const origin = event.composedPath()[0]
  return origin instanceof HTMLElement && isEditable(origin)
}

const SUBTITLE_LINE_SELECTOR = '[data-slot="subtitle-line"]'

export function isFromSubtitleLine(event: Event) {
  return event
    .composedPath()
    .some((node) => node instanceof Element && node.matches(SUBTITLE_LINE_SELECTOR))
}
