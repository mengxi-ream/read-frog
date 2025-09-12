import type { TransNode } from '@/types/dom'
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from '@/utils/constants/dom-labels'
import {
  isDontWalkIntoAndDontTranslateAsChildElement,
  isDontWalkIntoButTranslateAsChildElement,
  isHTMLElement,
  isIFrameElement,
  isShallowBlockHTMLElement,
  isShallowInlineHTMLElement,
  isTextNode,
} from './filter'

export function extractTextContent(node: TransNode): string {
  if (isTextNode(node)) {
    return node.textContent ?? ''
  }

  // We already don't walk and label the element which isDontWalkIntoElement
  // for the parent element we already walk and label, if we have a notranslate element inside this parent element,
  // we should extract the text content of the parent.
  // see this issue: https://github.com/mengxi-ream/read-frog/issues/249
  // if (isDontWalkIntoButTranslateAsChildElement(node)) {
  //   return ''
  // }

  if (isDontWalkIntoAndDontTranslateAsChildElement(node)) {
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
  if (isDontWalkIntoButTranslateAsChildElement(element)) {
    return false
  }

  if (isDontWalkIntoAndDontTranslateAsChildElement(element)) {
    return false
  }

  element.setAttribute(WALKED_ATTRIBUTE, walkId)

  if (element.shadowRoot) {
    for (const child of element.shadowRoot.children) {
      if (isHTMLElement(child)) {
        walkAndLabelElement(child, walkId)
      }
    }
  }

  if (isIFrameElement(element)) {
    const iframeDocument = element.contentDocument
    if (iframeDocument && iframeDocument.body) {
      walkAndLabelElement(iframeDocument.body, walkId)
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
