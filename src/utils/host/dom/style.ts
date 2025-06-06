/**
 * Smash the truncation style of the node if it has truncation style
 * @param element - The node to smash the truncation style
 */
import styleContent from '@/entrypoints/host.content/style.css?inline'

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

const documentsWithStyles = new WeakSet<Document>()

/**
 * Inject styles into a document
 */
export function injectStylesIntoDocument(doc: Document): void {
  if (documentsWithStyles.has(doc)) {
    return
  }
  documentsWithStyles.add(doc)
  try {
    const styleElement = doc.createElement('style')
    styleElement.textContent = styleContent
    styleElement.setAttribute('data-read-frog-styles', 'true')

    // Insert the style element into the head
    const head = doc.head || doc.documentElement
    if (head) {
      head.appendChild(styleElement)
    }
  }
  catch (error) {
    logger.error('Failed to inject styles into document:', error)
  }
}
