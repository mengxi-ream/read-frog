import type { TransNode } from '@/types/dom'
import {
  BLOCK_ATTRIBUTE,
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_ATTRIBUTE,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from '@/utils/constants/dom-labels'
import { FORCE_BLOCK_TAGS } from '@/utils/constants/dom-tags'

export function isEditable(element: HTMLElement): boolean {
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA')
    return true
  if (element.isContentEditable)
    return true
  return false
}

// shallow means only check the node itself, not the children
// if a shallow inline node has children are block node, then it's block node rather than inline node
export function isShallowInlineTransNode(node: Node): boolean {
  if (isTextNode(node)) {
    return true
  }
  else if (isHTMLElement(node)) {
    return isShallowInlineHTMLElement(node)
  }
  return false
}

export function isShallowInlineHTMLElement(element: HTMLElement): boolean {
  if (
    element.classList.contains(NOTRANSLATE_CLASS)
    || !element.textContent?.trim()
  ) {
    return false
  }

  return (
    window.getComputedStyle(element).display.includes('inline')
    && !FORCE_BLOCK_TAGS.has(element.tagName)
  )
}

// Note: !(inline node) != block node because of `notranslate` class and all cases not in the if else block
export function isShallowBlockTransNode(node: Node): boolean {
  if (isTextNode(node)) {
    return false
  }
  else if (isHTMLElement(node)) {
    return isShallowBlockHTMLElement(node)
  }
  return false
}

export function isShallowBlockHTMLElement(element: HTMLElement): boolean {
  if (
    element.classList.contains(NOTRANSLATE_CLASS)
    || !element.textContent?.trim()
  ) {
    return false
  }
  return (
    !window.getComputedStyle(element).display.includes('inline')
    || FORCE_BLOCK_TAGS.has(element.tagName)
  )
}

export function isDontWalkIntoElement(element: HTMLElement): boolean {
  const dontWalkClass = [NOTRANSLATE_CLASS, 'sr-only'].some(className =>
    element.classList.contains(className),
  )

  const dontWalkCSS
    = window.getComputedStyle(element).display === 'none'
      || window.getComputedStyle(element).visibility === 'hidden'

  return dontWalkClass || dontWalkCSS
}

export function isInlineTransNode(node: TransNode): boolean {
  if (isTextNode(node)) {
    return true
  }
  return node.hasAttribute(INLINE_ATTRIBUTE)
}

export function isBlockTransNode(node: TransNode): boolean {
  if (isTextNode(node)) {
    return false
  }
  return node.hasAttribute(BLOCK_ATTRIBUTE)
}

/**
 * More reliable check for HTML elements that works across different contexts (iframe, shadow DOM)
 * avoid using instanceof HTMLElement
 * @param node - The node to check
 * @returns Whether the node is an HTML element
 */
export function isHTMLElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE
    && node.nodeName !== undefined
    && 'tagName' in node
    && 'getAttribute' in node
    && 'setAttribute' in node
}

/**
 * More reliable check for Text nodes that works across different contexts
 * avoid using instanceof Text
 * @param node - The node to check
 * @returns Whether the node is a Text node
 */
export function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE
    && 'textContent' in node
    && 'data' in node
}

export function isIFrameElement(node: Node): node is HTMLIFrameElement {
  return node.nodeType === Node.ELEMENT_NODE
    && node.nodeName === 'IFRAME'
}

export function isTranslatedWrapperNode(node: Node) {
  return isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS)
}

/**
 * Check if a node is translated content (block or inline)
 */
export function isTranslatedContentNode(node: Node): boolean {
  return isHTMLElement(node) && (node.classList.contains(BLOCK_CONTENT_CLASS) || node.classList.contains(INLINE_CONTENT_CLASS))
}
