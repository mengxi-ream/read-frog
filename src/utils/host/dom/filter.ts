import type { TransNode } from '@/types/dom'
import { FORCE_BLOCK_TAGS } from '@/utils/constants/dom'
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  NOTRANSLATE_CLASS,
} from '@/utils/constants/translation'

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
  if (node instanceof Text) {
    return true
  }
  else if (node instanceof HTMLElement) {
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
  if (node instanceof Text) {
    return false
  }
  else if (node instanceof HTMLElement) {
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
  if (node instanceof Text) {
    return true
  }
  return node.hasAttribute(INLINE_ATTRIBUTE)
}

export function isBlockTransNode(node: TransNode): boolean {
  if (node instanceof Text) {
    return false
  }
  return node.hasAttribute(BLOCK_ATTRIBUTE)
}
