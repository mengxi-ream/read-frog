import type { TransNode } from '@/types/dom'
import { globalConfig } from '@/utils/config/config'
import {
  BLOCK_ATTRIBUTE,
  CONSECUTIVE_INLINE_END_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from '@/utils/constants/dom-labels'
import {
  INVALID_TRANSLATE_TAGS,
  MAIN_CONTENT_IGNORE_TAGS,
} from '@/utils/constants/dom-tags'

import { translateNodes } from '../translate/node-manipulation'
import {
  isDontWalkIntoElement,
  isHTMLElement,
  isIFrameElement,
  isInlineTransNode,
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
  // if (isDontWalkIntoElement(node)) {
  //   return ''
  // }

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
  const promises: Promise<void>[] = []

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
      promises.push(translateNodes([element], toggle))
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
          promises.push(dealWithConsecutiveInlineNodes(consecutiveInlineNodes, toggle))
          consecutiveInlineNodes = []
        }

        if (isHTMLElement(child)) {
          promises.push(translateWalkedElement(child, walkId, toggle))
        }
      }

      if (consecutiveInlineNodes.length) {
        promises.push(dealWithConsecutiveInlineNodes(consecutiveInlineNodes, toggle))
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
  }
  // This simultaneously ensures that when concurrent translation
  // and external await call this function, all translations are completed
  await Promise.all(promises)
}

async function dealWithConsecutiveInlineNodes(nodes: TransNode[], toggle: boolean = false) {
  if (nodes.length > 1) {
    // give attribute to the last node
    const lastNode = nodes[nodes.length - 1]
    if (isHTMLElement(lastNode)) {
      lastNode.setAttribute(CONSECUTIVE_INLINE_END_ATTRIBUTE, '')
    }
  }
  await translateNodes(nodes, toggle)
}
