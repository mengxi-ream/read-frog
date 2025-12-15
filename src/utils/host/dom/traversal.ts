import type { Config } from '@/types/config/config'
import type { TransNode } from '@/types/dom'
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from '@/utils/constants/dom-labels'
import { FORCE_BLOCK_TAGS } from '@/utils/constants/dom-rules'
import {
  isDontWalkIntoAndDontTranslateAsChildElement,
  isDontWalkIntoButTranslateAsChildElement,
  isHTMLElement,
  isShallowBlockHTMLElement,
  isShallowBlockTransNode,
  isShallowInlineHTMLElement,
  isShallowInlineTransNode,
  isTextNode,
} from './filter'

export function extractTextContent(node: TransNode, config: Config): string {
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

  if (isDontWalkIntoAndDontTranslateAsChildElement(node, config)) {
    return ''
  }

  const childNodes = Array.from(node.childNodes)
  return childNodes.reduce((text: string, child: Node): string => {
    // TODO: support SVGElement in the future
    if (isTextNode(child) || isHTMLElement(child)) {
      return text + extractTextContent(child, config)
    }
    return text
  }, '')
}

export function walkAndLabelElement(
  element: HTMLElement,
  walkId: string,
  config: Config,
): { forceBlock: boolean, isInlineNode: boolean } {
  if (isDontWalkIntoButTranslateAsChildElement(element) || isDontWalkIntoAndDontTranslateAsChildElement(element, config)) {
    return {
      forceBlock: false,
      isInlineNode: false,
    }
  }

  element.setAttribute(WALKED_ATTRIBUTE, walkId)

  if (element.shadowRoot) {
    for (const child of element.shadowRoot.children) {
      if (isHTMLElement(child)) {
        walkAndLabelElement(child, walkId, config)
      }
    }
  }

  let hasInlineNodeChild = false
  let forceBlock = false

  const validChildNodes = Array.from(element.childNodes).filter((child: ChildNode) => {
    if (child.nodeType === Node.TEXT_NODE)
      return true
    if (isHTMLElement(child)) {
      return !((isDontWalkIntoButTranslateAsChildElement(child) || isDontWalkIntoAndDontTranslateAsChildElement(child, config)))
    }
    return false
  })

  for (const child of validChildNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent?.trim()) {
        hasInlineNodeChild = true
      }
      continue
    }

    if (isHTMLElement(child)) {
      const result = walkAndLabelElement(child, walkId, config)

      forceBlock = forceBlock || result.forceBlock

      if (result.isInlineNode) {
        hasInlineNodeChild = true
      }
    }
  }

  if (hasInlineNodeChild) {
    element.setAttribute(PARAGRAPH_ATTRIBUTE, '')
  }

  const translateChildCount = Array.from(validChildNodes).filter(child =>
    isShallowBlockTransNode(child) || isShallowInlineTransNode(child),
  ).length
  const blockChildCount = Array.from(validChildNodes).filter(child =>
    isShallowBlockTransNode(child),
  ).length

  // force block will force the current and ancestor elements to be block node
  forceBlock = forceBlock || (blockChildCount >= 1 && translateChildCount > 1) || FORCE_BLOCK_TAGS.has(element.tagName)

  if (element.textContent?.trim() === '' && !forceBlock) {
    return {
      forceBlock: false,
      isInlineNode: false,
    }
  }

  const isInlineNode = isShallowInlineHTMLElement(element)

  if (isShallowBlockHTMLElement(element) || forceBlock) {
    element.setAttribute(BLOCK_ATTRIBUTE, '')
  }
  else if (isInlineNode) {
    element.setAttribute(INLINE_ATTRIBUTE, '')
  }

  return {
    forceBlock,
    isInlineNode,
  }
}
