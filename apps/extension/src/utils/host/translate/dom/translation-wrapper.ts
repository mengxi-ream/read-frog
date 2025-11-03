import { CONTENT_WRAPPER_CLASS, WALKED_ATTRIBUTE } from '../../../constants/dom-labels'
import { isHTMLElement } from '../../dom/filter'

export function findPreviousTranslatedWrapperInside(node: Element | Text, walkId: string): HTMLElement | null {
  if (isHTMLElement(node)) {
    // Check if the node itself is a translated wrapper
    if (node.classList.contains(CONTENT_WRAPPER_CLASS) && node.getAttribute(WALKED_ATTRIBUTE) !== walkId) {
      return node
    }
    // Otherwise, look for a wrapper as a child that doesn't match the current walkId
    return node.querySelector(`.${CONTENT_WRAPPER_CLASS}:not([${WALKED_ATTRIBUTE}="${walkId}"])`)
  }
  return null
}
