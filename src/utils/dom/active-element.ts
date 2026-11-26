/** Resolve the focused control through open shadow roots (including nested hosts). */
export function getDeepActiveElement(doc: Document = document): Element | null {
  let element = doc.activeElement
  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement
  }
  return element
}
