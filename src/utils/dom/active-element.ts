/** Resolve the focused control through open shadow roots (including nested hosts). */
export function getDeepActiveElement(): Element | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement
  }
  return element
}
