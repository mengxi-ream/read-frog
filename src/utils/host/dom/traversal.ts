import type { Point, TransNode } from '@/types/dom'
import { globalConfig } from '@/utils/config/config'
import {
  INVALID_TRANSLATE_TAGS,
  MAIN_CONTENT_IGNORE_TAGS,
} from '@/utils/constants/dom'
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from '@/utils/constants/translation'

import { translateNode } from '../translate'
import {
  isDontWalkIntoElement,
  isHTMLElement,
  isShallowBlockHTMLElement,
  isShallowInlineHTMLElement,
  isTextNode,
} from './filter'
import { smashTruncationStyle } from './style'

/**
 * Find the deepest element at the given point, including inside shadow roots
 * @param root - The root element (Document or ShadowRoot)
 * @param point - The point to find the deepest element
 */
export function findElementAt(root: Document | ShadowRoot, point: Point): Element | null {
  const { x, y } = point

  function findDeepestElement(element: Element): Element {
    for (const child of element.children) {
      if (isHTMLElement(child)) {
        const rect = child.getBoundingClientRect()
        const isPointInChild = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

        if (isPointInChild) {
          if (child.shadowRoot) {
            const shadowResult = findElementAt(child.shadowRoot, point)
            if (shadowResult) {
              return shadowResult
            }
          }
          return findDeepestElement(child)
        }
      }
    }
    // No deeper child found, return current element
    return element
  }

  const initialElement = root.elementFromPoint(x, y)
  if (!initialElement) {
    return null
  }

  return findDeepestElement(initialElement)
}

/**
 * Find the nearest block node from the point
 * @param point - The point to find the nearest block node
 */
export function findNearestBlockNodeAt(point: Point) {
  let currentNode = findElementAt(document, point)

  // TODO: support SVGElement in the future
  while (
    currentNode && isHTMLElement(currentNode)
    && isShallowInlineHTMLElement(currentNode)
  ) {
    currentNode = currentNode.parentElement
  }

  return currentNode
}

export function extractTextContent(node: TransNode): string {
  if (isTextNode(node)) {
    return node.textContent ?? ''
  }

  if (isDontWalkIntoElement(node)) {
    return ''
  }

  const childNodes = Array.from(node.childNodes)
  return childNodes.reduce((text: string, child: Node): string => {
    // TODO: support SVGElement in the future
    if (isTextNode(child) || isHTMLElement(child)) {
      return text + extractTextContent(child)
    }
    return text
  }, '')
}

/**
 * Walk and label the element
 * @param element - The element to walk and label
 * @param walkId - The walk id
 * @returns "hasBlock" if the element has a block node child or is block node, false otherwise (has inline node child or is inline node or other nodes should be ignored)
 */
export function walkAndLabelElement(
  element: HTMLElement,
  walkId: string,
): 'hasBlock' | false {
  element.setAttribute(WALKED_ATTRIBUTE, walkId)

  if (isDontWalkIntoElement(element)) {
    return false
  }

  if (
    globalConfig
    && globalConfig.translate.page.range !== 'all'
    && MAIN_CONTENT_IGNORE_TAGS.has(element.tagName)
  ) {
    return false
  }

  if (INVALID_TRANSLATE_TAGS.has(element.tagName)) {
    return false
  }

  if (element.shadowRoot) {
    if (globalConfig && globalConfig.translate.page.range === 'all') {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          walkAndLabelElement(child, walkId)
        }
      }
    }
    else {
      return false
    }
  }

  let hasInlineNodeChild = false
  let hasBlockNodeChild = false

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent?.trim()) {
        hasInlineNodeChild = true
      }
      continue
    }

    if (isHTMLElement(child)) {
      const hasBlock = walkAndLabelElement(child, walkId)

      if (hasBlock) {
        hasBlockNodeChild = true
      }
      else if (child.textContent?.trim()) {
        hasInlineNodeChild = true
      }
    }
  }

  if (hasInlineNodeChild) {
    element.setAttribute(PARAGRAPH_ATTRIBUTE, '')
  }

  if (hasBlockNodeChild || isShallowBlockHTMLElement(element)) {
    element.setAttribute(BLOCK_ATTRIBUTE, '')
    return 'hasBlock'
  }
  else if (isShallowInlineHTMLElement(element)) {
    element.setAttribute(INLINE_ATTRIBUTE, '')
  }

  return false
}

/**
 * Translate the element if it has inline node child
 * @param element - The element to translate
 * @param walkId - The walk id
 * @param toggle - Whether to toggle the translation, if true, the translation will be removed if it already exists
 */
export function translateWalkedElement(
  element: HTMLElement,
  walkId: string,
  toggle: boolean = false,
) {
  // if the walkId is not the same, return
  if (element.getAttribute(WALKED_ATTRIBUTE) !== walkId)
    return

  if (element.hasAttribute(PARAGRAPH_ATTRIBUTE)) {
    let hasBlockNodeChild = false

    for (const child of element.childNodes) {
      if (isHTMLElement(child) && child.hasAttribute(BLOCK_ATTRIBUTE)) {
        hasBlockNodeChild = true
        break
      }
    }

    if (!hasBlockNodeChild) {
      translateNode(element, toggle)
    }
    else {
      // prevent children change during iteration
      const children = Array.from(element.childNodes)
      for (const child of children) {
        if (!child.textContent?.trim()) {
          continue
        }

        if (isTextNode(child)) {
          translateNode(child, toggle)
        }
        else if (isHTMLElement(child)) {
          translateWalkedElement(child, walkId, toggle)
        }
      }
    }
  }
  else {
    for (const child of element.childNodes) {
      if (isHTMLElement(child)) {
        translateWalkedElement(child, walkId, toggle)
      }
    }
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          translateWalkedElement(child, walkId, toggle)
        }
      }
    }
  }
}

export function unwrapDeepestOnlyChild(element: HTMLElement) {
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
