import type { Point, TransNode } from '@/types/dom'
import React from 'react'
import textSmallCSS from '@/assets/tailwind/text-small.css?inline'
import themeCSS from '@/assets/tailwind/theme.css?inline'
import { TranslationError } from '@/components/tranlation/error'
import { Spinner } from '@/components/tranlation/spinner'
import { createReactShadowHost, removeReactShadowHost } from '@/utils/react-shadow-host/create-shadow-host'
import {
  BLOCK_CONTENT_CLASS,
  CONSECUTIVE_INLINE_END_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
  REACT_SHADOW_HOST_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
} from '../../constants/dom-labels'
import { FORCE_INLINE_TRANSLATION_TAGS } from '../../constants/dom-tags'
import { isBlockTransNode, isHTMLElement, isInlineTransNode, isTextNode, isTranslatedContentNode, isTranslatedWrapperNode } from '../dom/filter'
import { deepQueryTopLevelSelector, findNearestAncestorBlockNodeAt, findTranslatedContentWrapper, unwrapDeepestOnlyHTMLChild } from '../dom/find'
import { getOwnerDocument } from '../dom/node'
import {
  extractTextContent,
  translateWalkedElement,
  walkAndLabelElement,
} from '../dom/traversal'
import { translateText } from './translate-text'

const translatingNodes = new Set<HTMLElement | Text>()

export async function hideOrShowNodeTranslation(point: Point) {
  const node = findNearestAncestorBlockNodeAt(point)

  if (!node || !isHTMLElement(node))
    return

  // Check if the found node is translated content
  if (isTranslatedContentNode(node)) {
    const wrapper = findTranslatedContentWrapper(node)
    if (wrapper) {
      removeShadowHostInTranslatedWrapper(wrapper)
      wrapper.remove()
    }
    return
  }

  const id = crypto.randomUUID()
  walkAndLabelElement(node, id)
  await translateWalkedElement(node, id, true)
}

export function removeAllTranslatedWrapperNodes(
  root: Document | ShadowRoot = document,
) {
  const translatedNodes = deepQueryTopLevelSelector(root, isTranslatedWrapperNode)
  translatedNodes.forEach((node) => {
    removeShadowHostInTranslatedWrapper(node)
    node.remove()
  })
}

/**
 * Translate the node
 * @param nodes - The nodes to translate
 * @param toggle - Whether to toggle the translation, if true, the translation will be removed if it already exists
 */
export async function translateNodes(nodes: TransNode[], toggle: boolean = false) {
  try {
    // prevent duplicate translation
    if (nodes.every(node => translatingNodes.has(node))) {
      return
    }
    nodes.forEach(node => translatingNodes.add(node))

    const lastNode = nodes[nodes.length - 1]
    const targetNode
      = nodes.length === 1 && isHTMLElement(lastNode) ? unwrapDeepestOnlyHTMLChild(lastNode) : lastNode

    const existedTranslatedWrapper = findExistedTranslatedWrapper(targetNode)
    if (existedTranslatedWrapper) {
      removeShadowHostInTranslatedWrapper(existedTranslatedWrapper)
      existedTranslatedWrapper.remove()
      if (toggle) {
        return
      }
    }

    const textContent = nodes.map(node => extractTextContent(node)).join(' ')
    if (!textContent)
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    const spinner = createSpinnerInside(translatedWrapperNode)

    if (isTextNode(targetNode) || nodes.length > 1) {
      targetNode.parentNode?.insertBefore(
        translatedWrapperNode,
        targetNode.nextSibling,
      )
    }
    else {
      targetNode.appendChild(translatedWrapperNode)
    }

    const translatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)

    if (!translatedText)
      return

    insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      targetNode,
      translatedText,
    )
  }
  finally {
    nodes.forEach(node => translatingNodes.delete(node))
  }
}

function createSpinnerInside(translatedWrapperNode: HTMLElement) {
  const spinComponent = React.createElement(Spinner)
  const container = createReactShadowHost(
    spinComponent,
    {
      position: 'inline',
      inheritStyles: false,
      cssContent: [themeCSS, textSmallCSS],
      style: {
        verticalAlign: 'middle',
      },
    },
  )
  translatedWrapperNode.appendChild(container)
  return container
}

function findExistedTranslatedWrapper(node: TransNode): HTMLElement | null {
  if (isTextNode(node) || node.hasAttribute(CONSECUTIVE_INLINE_END_ATTRIBUTE)) {
    if (
      node.nextSibling && isHTMLElement(node.nextSibling)
      && node.nextSibling.classList.contains(NOTRANSLATE_CLASS)
    ) {
      return node.nextSibling
    }
  }
  else if (isHTMLElement(node)) {
    return node.querySelector(`:scope > .${NOTRANSLATE_CLASS}`)
  }
  return null
}

function insertTranslatedNodeIntoWrapper(
  translatedWrapperNode: HTMLElement,
  targetNode: TransNode,
  translatedText: string,
) {
  // Use the wrapper's owner document
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const translatedNode = ownerDoc.createElement('span')
  const isForceInlineTranslationElement
    = isHTMLElement(targetNode)
      && FORCE_INLINE_TRANSLATION_TAGS.has(targetNode.tagName)

  if (isForceInlineTranslationElement || isInlineTransNode(targetNode)) {
    const spaceNode = ownerDoc.createElement('span')
    spaceNode.textContent = '  '
    translatedWrapperNode.appendChild(spaceNode)
    translatedNode.className = `${NOTRANSLATE_CLASS} ${INLINE_CONTENT_CLASS}`
  }
  else if (isBlockTransNode(targetNode)) {
    const brNode = ownerDoc.createElement('br')
    translatedWrapperNode.appendChild(brNode)
    translatedNode.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
  }
  else {
    // not inline or block, maybe notranslate
    return
  }

  translatedNode.textContent = translatedText
  translatedWrapperNode.appendChild(translatedNode)
}

async function getTranslatedTextAndRemoveSpinner(nodes: TransNode[], textContent: string, spinner: HTMLElement, translatedWrapperNode: HTMLElement) {
  let translatedText: string | undefined

  try {
    translatedText = await translateText(textContent)
  }
  catch (error) {
    removeReactShadowHost(spinner)

    const errorComponent = React.createElement(TranslationError, {
      nodes,
      error: error as Error,
    })

    const container = createReactShadowHost(
      errorComponent,
      {
        className: TRANSLATION_ERROR_CONTAINER_CLASS,
        position: 'inline',
        inheritStyles: false,
        cssContent: [themeCSS, textSmallCSS],
        style: {
          verticalAlign: 'middle',
        },
      },
    )

    translatedWrapperNode.appendChild(container)
  }
  finally {
    removeReactShadowHost(spinner)
  }

  return translatedText
}

function removeShadowHostInTranslatedWrapper(wrapper: HTMLElement) {
  const translationShadowHost = wrapper.querySelector(`.${REACT_SHADOW_HOST_CLASS}`)
  if (translationShadowHost && isHTMLElement(translationShadowHost)) {
    removeReactShadowHost(translationShadowHost)
  }
}
