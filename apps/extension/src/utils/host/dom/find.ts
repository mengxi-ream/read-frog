import type { Point } from '@/types/dom'

import { isHTMLElement, isIFrameElement, isShallowInlineHTMLElement, isTranslatedContentNode, isTranslatedWrapperNode } from './filter'
import { smashTruncationStyle } from './style'

export function getOwnerDocument(node: Node): Document {
  return node.ownerDocument || document
}

/**
 * Find the deepest element at the given point, including inside shadow roots
 * @param root - The root element (Document or ShadowRoot)
 * @param point - The point to find the deepest element
 */
function findElementAt(root: Document | ShadowRoot, point: Point): Element | null {
  const { x, y } = point

  // First, try to get the element at the point from the root
  const initialElement = root.elementFromPoint(x, y)
  if (!initialElement) {
    return null
  }

  // If the initial element has a shadow root, check if the point is actually inside the shadow content
  if (initialElement.shadowRoot) {
    const shadowElement = findElementAt(initialElement.shadowRoot, point)
    if (shadowElement) {
      return shadowElement
    }
  }

  // Find the deepest element by traversing children
  function findDeepestElement(element: Element): Element {
    let deepestElement = element

    for (const child of element.children) {
      if (isHTMLElement(child)) {
        const rect = child.getBoundingClientRect()
        const isPointInChild = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

        if (isPointInChild) {
          // If child has shadow root, recursively search within it
          if (child.shadowRoot) {
            const shadowResult = findElementAt(child.shadowRoot, point)
            if (shadowResult) {
              return shadowResult
            }
          }

          // Continue searching deeper in this child
          deepestElement = findDeepestElement(child)
          if (deepestElement.textContent?.trim())
            return deepestElement
        }
      }
    }

    return deepestElement
  }

  return findDeepestElement(initialElement)
}

/**
 * Find the nearest block node from the point
 * @param point - The point to find the nearest block node
 */
export function findNearestAncestorBlockNodeAt(point: Point) {
  let currentNode = findElementAt(document, point)

  while (
    currentNode && isHTMLElement(currentNode)
    && isShallowInlineHTMLElement(currentNode)
  ) {
    currentNode = currentNode.parentElement
  }

  return currentNode
}

export function deepQueryTopLevelSelector(element: HTMLElement | ShadowRoot | Document, selectorFn: (element: HTMLElement) => boolean): HTMLElement[] {
  if (element instanceof Document) {
    return deepQueryTopLevelSelector(element.body, selectorFn)
  }

  const result: HTMLElement[] = []
  if (element instanceof ShadowRoot) {
    for (const child of element.children) {
      if (isHTMLElement(child)) {
        result.push(...deepQueryTopLevelSelector(child, selectorFn))
      }
    }
    return result
  }

  if (selectorFn(element)) {
    return [element]
  }

  if (element.shadowRoot) {
    for (const child of element.shadowRoot.children) {
      if (isHTMLElement(child)) {
        result.push(...deepQueryTopLevelSelector(child, selectorFn))
      }
    }
  }

  if (isIFrameElement(element)) {
    const iframeDocument = element.contentDocument
    if (iframeDocument && iframeDocument.body) {
      result.push(...deepQueryTopLevelSelector(iframeDocument.body, selectorFn))
    }
  }

  for (const child of element.children) {
    if (isHTMLElement(child)) {
      result.push(...deepQueryTopLevelSelector(child, selectorFn))
    }
  }

  return result
}

export function unwrapDeepestOnlyHTMLChild(element: HTMLElement) {
  let currentElement = element
  while (currentElement) {
    smashTruncationStyle(currentElement)

    const onlyChild
      = currentElement.childNodes.length === 1
        && currentElement.children.length === 1
    if (!onlyChild)
      break

    const onlyChildElement = currentElement.children[0]
    if (!isHTMLElement(onlyChildElement))
      break

    currentElement = onlyChildElement
  }

  return currentElement
}

/**
 * Find the nearest translated content wrapper ancestor
 * @param node - The node should be a translated content node
 */
export function findTranslatedContentWrapper(node: HTMLElement): HTMLElement | null {
  if (!isTranslatedContentNode(node))
    return null

  let currentElement = node.parentElement
  while (currentElement) {
    if (isTranslatedWrapperNode(currentElement)) {
      return currentElement
    }
    currentElement = currentElement.parentElement
  }
  return null
}
