/**
 * Smash the truncation style of the node if it has truncation style
 * @param element - The node to smash the truncation style
 */
export function smashTruncationStyle(element: HTMLElement) {
  if (element.style && element.style.webkitLineClamp) {
    element.style.webkitLineClamp = 'unset'
  }
  if (element.style && element.style.maxHeight) {
    element.style.maxHeight = 'unset'
  }
}
