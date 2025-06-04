import type { Point, TransNode } from '@/types/dom'
import { globalConfig } from '@/utils/config/config'
import {
  INVALID_TRANSLATE_TAGS,
  MAIN_CONTENT_IGNORE_TAGS,
} from '@/utils/constants/dom'
import {
  BLOCK_ATTRIBUTE,
  CONSECUTIVE_INLINE_END_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from '@/utils/constants/translation'

import { translateConsecutiveInlineNodes, translateNode } from '../translate/node-manipulation'
import {
  isDontWalkIntoElement,
  isHTMLElement,
  isInlineTransNode,
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
): 'isOrHasBlockNode' | 'isShallowInlineNode' | false {
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
      const result = walkAndLabelElement(child, walkId)

      if (result === 'isOrHasBlockNode') {
        hasBlockNodeChild = true
      }
      else if (result === 'isShallowInlineNode') {
        hasInlineNodeChild = true
      }
    }
  }

  if (hasInlineNodeChild) {
    element.setAttribute(PARAGRAPH_ATTRIBUTE, '')
  }

  if (hasBlockNodeChild || isShallowBlockHTMLElement(element)) {
    element.setAttribute(BLOCK_ATTRIBUTE, '')
    return 'isOrHasBlockNode'
  }
  else if (isShallowInlineHTMLElement(element)) {
    element.setAttribute(INLINE_ATTRIBUTE, '')
    return 'isShallowInlineNode'
  }

  return false
}

/**
 * Translate the element if it has inline node child
 * @param element - The element to translate
 * @param walkId - The walk id
 * @param toggle - Whether to toggle the translation, if true, the translation will be removed if it already exists
 */
export async function translateWalkedElement(
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
      await translateNode(element, toggle)
    }
    else {
      // prevent children change during iteration
      const children = Array.from(element.childNodes)
      let consecutiveInlineNodes: TransNode[] = []
      for (const child of children) {
        if (!child.textContent?.trim()) {
          continue
        }
        if (!(isTextNode(child) || isHTMLElement(child))) {
          continue
        }

        if (isInlineTransNode(child)) {
          consecutiveInlineNodes.push(child)
          continue
        }
        else if (consecutiveInlineNodes.length) {
          await dealWithConsecutiveInlineNodes(consecutiveInlineNodes, toggle)
          consecutiveInlineNodes = []
        }

        if (isHTMLElement(child)) {
          await translateWalkedElement(child, walkId, toggle)
        }
      }

      if (consecutiveInlineNodes.length) {
        await dealWithConsecutiveInlineNodes(consecutiveInlineNodes, toggle)
        consecutiveInlineNodes = []
      }
    }
  }
  else {
    const promises: Promise<void>[] = []
    for (const child of element.childNodes) {
      if (isHTMLElement(child)) {
        promises.push(translateWalkedElement(child, walkId, toggle))
      }
    }
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          promises.push(translateWalkedElement(child, walkId, toggle))
        }
      }
    }
    await Promise.all(promises)
  }
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

async function dealWithConsecutiveInlineNodes(nodes: TransNode[], toggle: boolean = false) {
  if (nodes.length > 1) {
    // give attribute to the last node
    const lastNode = nodes[nodes.length - 1]
    if (isHTMLElement(lastNode)) {
      lastNode.setAttribute(CONSECUTIVE_INLINE_END_ATTRIBUTE, '')
    }
    await translateConsecutiveInlineNodes(nodes, toggle)
  }
  else if (nodes.length === 1) {
    await translateNode(nodes[0], toggle)
  }
}
