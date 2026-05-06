import { CONTENT_WRAPPER_CLASS } from "../../../constants/dom-labels"
import { isHTMLElement, isTextNode } from "../../dom/filter"

function findAdjacentTranslatedWrapper(node: Element | Text): HTMLElement | null {
  let sibling = node.nextSibling

  while (sibling) {
    if (isTextNode(sibling)) {
      if (sibling.textContent?.trim()) {
        return null
      }
      sibling = sibling.nextSibling
      continue
    }

    if (!isHTMLElement(sibling)) {
      return null
    }

    if (sibling.classList.contains(CONTENT_WRAPPER_CLASS)) {
      return sibling
    }

    return null
  }

  return null
}

export function findPreviousTranslatedWrapperInside(node: Element | Text): HTMLElement | null {
  if (isHTMLElement(node)) {
    // Check if the node itself is a translated wrapper
    if (node.classList.contains(CONTENT_WRAPPER_CLASS)) {
      return node
    }

    // Don't check the previous sibling because the wrapper should be either the node itself or its descendant
    const descendantWrapper = node.querySelector<HTMLElement>(`.${CONTENT_WRAPPER_CLASS}`)
    if (descendantWrapper) {
      return descendantWrapper
    }
  }

  return findAdjacentTranslatedWrapper(node)
}
