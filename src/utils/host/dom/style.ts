/**
 * Smash the truncation style of the node if it has truncation style
 * @param element - The node to smash the truncation style
 */
export function smashTruncationStyle(element: HTMLElement) {
  const computedStyle = window.getComputedStyle(element)

  if (computedStyle.webkitLineClamp && computedStyle.webkitLineClamp !== 'none') {
    element.style.webkitLineClamp = 'unset'
  }

  if (computedStyle.maxHeight && computedStyle.maxHeight !== 'none') {
    element.style.maxHeight = 'unset'
  }

  if (computedStyle.overflow === 'hidden') {
    element.style.overflow = 'visible'
  }

  if (computedStyle.textOverflow === 'ellipsis') {
    element.style.textOverflow = 'unset'
  }
}
