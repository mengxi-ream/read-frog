import type { APICallError } from 'ai'
import type { TranslationMode } from '@/types/config/translate'
import type { Point, TransNode } from '@/types/dom'
import React from 'react'
import textSmallCSS from '@/assets/tailwind/text-small.css?inline'
import themeCSS from '@/assets/tailwind/theme.css?inline'
import { TranslationError } from '@/components/translation/error'
import { Spinner } from '@/components/translation/spinner'
import { globalConfig } from '@/utils/config/config'
import { createReactShadowHost, removeReactShadowHost } from '@/utils/react-shadow-host/create-shadow-host'
import {
  BLOCK_ATTRIBUTE,
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  MARK_ATTRIBUTES,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  REACT_SHADOW_HOST_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from '../../constants/dom-labels'
import { FORCE_INLINE_TRANSLATION_TAGS } from '../../constants/dom-tags'
import { isBlockTransNode, isHTMLElement, isInlineTransNode, isTextNode, isTranslatedWrapperNode, isTransNode } from '../dom/filter'
import { deepQueryTopLevelSelector, findNearestAncestorBlockNodeAt, unwrapDeepestOnlyHTMLChild } from '../dom/find'
import { getOwnerDocument } from '../dom/node'
import {
  extractTextContent,
  walkAndLabelElement,
} from '../dom/traversal'
import { decorateTranslationNode } from './decorate-translation'
import { translateText, validateTranslationConfig } from './translate-text'

const translatingNodes = new WeakSet<ChildNode>()
const originalContentMap = new Map<Element, string>()

// Pre-compiled regex for better performance - removes all mark attributes
const MARK_ATTRIBUTES_REGEX = new RegExp(`\\s*(?:${Array.from(MARK_ATTRIBUTES).join('|')})(?:=['""][^'"]*['""]|=[^\\s>]*)?`, 'g')

export async function removeOrShowNodeTranslation(point: Point, translationMode: TranslationMode) {
  const node = findNearestAncestorBlockNodeAt(point)

  if (!node || !isHTMLElement(node))
    return

  if (!globalConfig) {
    throw new Error('Global config is not initialized')
  }

  if (!validateTranslationConfig({
    providersConfig: globalConfig.providersConfig,
    translate: globalConfig.translate,
    language: globalConfig.language,
  })) {
    return
  }

  const id = crypto.randomUUID()
  walkAndLabelElement(node, id)
  await translateWalkedElement(node, id, translationMode, true)
}

export function removeAllTranslatedWrapperNodes(
  root: Document | ShadowRoot = document,
) {
  if (!globalConfig) {
    throw new Error('Global config is not initialized')
  }

  const translatedNodes = deepQueryTopLevelSelector(root, isTranslatedWrapperNode)
  translatedNodes.forEach((contentWrapperNode) => {
    removeTranslatedWrapperWithRestore(contentWrapperNode)
  })
}

export async function translateNodes(nodes: ChildNode[], translationMode: TranslationMode, walkId: string, toggle: boolean = false) {
  if (translationMode === 'translationOnly') {
    await translateNodeTranslationOnlyMode(nodes, walkId, toggle)
  }
  else {
    await translateNodesBilingualMode(nodes, walkId, toggle)
  }
}

/**
 * Translate the node
 * @param nodes - The nodes to translate
 * @param walkId - The walk ID for the translation
 * @param toggle - Whether to toggle the translation, if true, the translation will be removed if it already exists
 */
export async function translateNodesBilingualMode(nodes: ChildNode[], walkId: string, toggle: boolean = false) {
  const transNodes = nodes.filter(node => isTransNode(node))
  if (transNodes.length === 0) {
    return
  }

  try {
    // prevent duplicate translation
    if (transNodes.every(node => translatingNodes.has(node))) {
      return
    }
    transNodes.forEach(node => translatingNodes.add(node))

    const lastNode = transNodes[transNodes.length - 1]
    const targetNode
      = transNodes.length === 1 && isBlockTransNode(lastNode) && isHTMLElement(lastNode) ? unwrapDeepestOnlyHTMLChild(lastNode) : lastNode

    const existedTranslatedWrapper = findPreviousTranslatedWrapper(targetNode, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        nodes.forEach(node => translatingNodes.delete(node))
        translateNodesBilingualMode(nodes, walkId, toggle)
        return
      }
    }

    const textContent = transNodes.map(node => extractTextContent(node)).join(' ')
    if (!textContent)
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, 'bilingual' satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    const spinner = createSpinnerInside(translatedWrapperNode)

    if (isTextNode(targetNode) || transNodes.length > 1) {
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
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}

export async function translateNodeTranslationOnlyMode(nodes: ChildNode[], walkId: string, toggle: boolean = false) {
  const outerTransNodes = nodes.filter(node => isTransNode(node))
  if (outerTransNodes.length === 0) {
    return
  }

  // snapshot the outer parent element, to prevent lose it if we go to deeper by unwrapDeepestOnlyHTMLChild
  // test case is:
  // <div data-testid="test-node">
  //   <span style={{ display: 'inline' }}>原文</span> // get the outer parent snapshot before go to inner element
  //   <br />
  //   <span style={{ display: 'inline' }}>原文</span>
  //   原文
  //   <br />
  //   <span style={{ display: 'inline' }}>原文</span>
  // </div>,
  const outerParentElement = outerTransNodes[0].parentElement
  if (outerParentElement && !originalContentMap.has(outerParentElement)) {
    originalContentMap.set(outerParentElement, outerParentElement.innerHTML)
  }

  let transNodes: TransNode[] = []
  let allChildNodes: ChildNode[] = []
  if (outerTransNodes.length === 1 && isHTMLElement(outerTransNodes[0])) {
    const unwrappedHTMLChild = unwrapDeepestOnlyHTMLChild(outerTransNodes[0])
    transNodes = Array.from(unwrappedHTMLChild.childNodes).filter((node): node is TransNode => {
      if (isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS))
        return false
      return isTransNode(node)
    })
    allChildNodes = Array.from(unwrappedHTMLChild.childNodes)
  }
  else {
    transNodes = outerTransNodes
    allChildNodes = nodes
  }

  if (transNodes.length === 0) {
    return
  }

  try {
    if (nodes.every(node => translatingNodes.has(node))) {
      return
    }
    nodes.forEach(node => translatingNodes.add(node))

    const targetNode = transNodes[transNodes.length - 1]

    const parentNode = targetNode.parentElement
    if (!parentNode) {
      console.error('targetNode.parentElement is not HTMLElement', targetNode.parentElement)
      return
    }
    const existedTranslatedWrapper = findPreviousTranslatedWrapper(targetNode.parentElement, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        // In translationOnly mode, removeTranslatedWrapperWithRestore uses innerHTML to restore content,
        // which destroys the original DOM nodes and creates new ones. The 'nodes' array still references
        // the old detached nodes, and targetNode can't reference to the new dom added by innerHTML anymore.
        // Therefore, by recursively calling translateNodeTranslationOnlyMode here with the
        // same nodes array, we ensure the translation uses the newly created DOM elements since the
        // function will re-query and find the correct parent and child nodes from the restored DOM.
        nodes.forEach(node => translatingNodes.delete(node))
        translateNodeTranslationOnlyMode(nodes, walkId, toggle)
        return
      }
    }

    const innerTextContent = transNodes.map(node => extractTextContent(node)).join(' ')
    if (!innerTextContent)
      return

    const cleanTextContent = (content: string): string => {
      if (!content)
        return content

      let cleanedContent = content.replace(MARK_ATTRIBUTES_REGEX, '')
      cleanedContent = cleanedContent.replace(/<!--[\s\S]*?-->/g, ' ')
      cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim()

      return cleanedContent
    }

    if (!originalContentMap.has(parentNode)) {
      originalContentMap.set(parentNode, parentNode.innerHTML)
    }

    const getStringFormatFromNode = (node: Element | Text) => {
      if (isTextNode(node)) {
        return node.textContent
      }
      return node.outerHTML
    }

    const textContent = cleanTextContent(transNodes.map(getStringFormatFromNode).join(''))
    if (!textContent)
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, 'translationOnly' satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    translatedWrapperNode.style.display = 'contents'
    const spinner = createSpinnerInside(translatedWrapperNode)

    if (isTextNode(targetNode) || transNodes.length > 1) {
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

    translatedWrapperNode.innerHTML = translatedText

    // Insert translated content after the last node
    const lastChildNode = allChildNodes[allChildNodes.length - 1]
    lastChildNode.parentNode?.insertBefore(translatedWrapperNode, lastChildNode.nextSibling)

    // Remove all original nodes
    allChildNodes.forEach(childNode => childNode.remove())
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
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
  )
  translatedWrapperNode.appendChild(container)
  return container
}

function findPreviousTranslatedWrapper(node: Element | Text, walkId: string): HTMLElement | null {
  if (isHTMLElement(node)) {
    // Check if the node itself is a translated wrapper
    if (node.classList.contains(CONTENT_WRAPPER_CLASS) && node.getAttribute(WALKED_ATTRIBUTE) !== walkId) {
      return node
    }
    // Otherwise, look for a wrapper as a child that doesn't match the current walkId
    return node.querySelector(`.${CONTENT_WRAPPER_CLASS}:not([${WALKED_ATTRIBUTE}="${walkId}"])`)
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
  decorateTranslationNode(translatedNode)
  translatedWrapperNode.appendChild(translatedNode)
}

async function getTranslatedTextAndRemoveSpinner(nodes: ChildNode[], textContent: string, spinner: HTMLElement, translatedWrapperNode: HTMLElement) {
  let translatedText: string | undefined

  try {
    translatedText = await translateText(textContent)
  }
  catch (error) {
    removeReactShadowHost(spinner)

    const errorComponent = React.createElement(TranslationError, {
      nodes,
      error: error as APICallError,
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

/**
 * Remove translated wrapper and restore original content based on translation mode
 * @param wrapper - The translated wrapper element to remove
 */
function removeTranslatedWrapperWithRestore(wrapper: HTMLElement) {
  removeShadowHostInTranslatedWrapper(wrapper)

  const translationMode = wrapper.getAttribute(TRANSLATION_MODE_ATTRIBUTE)

  if (translationMode === 'translationOnly') {
    // For translation-only mode, find nearest ancestor in originalContentMap and restore
    let currentNode = wrapper.parentNode

    while (currentNode && isHTMLElement(currentNode)) {
      const originalContent = originalContentMap.get(currentNode)
      if (originalContent) {
        currentNode.innerHTML = originalContent
        originalContentMap.delete(currentNode)
        return
      }
      currentNode = currentNode.parentNode
    }
  }

  // For bilingual mode or when no original content is found, just remove the wrapper
  wrapper.remove()
}

/**
 * Translate the element if it has inline node child
 * @param element - The element to translate
 * @param walkId - The walk id
 * @param translationMode - The translation mode
 * @param toggle - Whether to toggle the translation, if true, the translation will be removed if it already exists
 */
export async function translateWalkedElement(
  element: HTMLElement,
  walkId: string,
  translationMode: TranslationMode,
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
      promises.push(translateNodes([element], translationMode, walkId, toggle))
    }
    else {
      // prevent children change during iteration
      const children = Array.from(element.childNodes)
      let consecutiveInlineNodes: ChildNode[] = []
      for (const child of children) {
        if (isTransNode(child) && isBlockTransNode(child) && !isTextNode(child)) {
          promises.push(translateNodes(consecutiveInlineNodes, translationMode, walkId, toggle))
          consecutiveInlineNodes = []
          promises.push(translateWalkedElement(child, walkId, translationMode, toggle))
        }
        else {
          consecutiveInlineNodes.push(child)
        }
      }

      if (consecutiveInlineNodes.length) {
        promises.push(translateNodes(consecutiveInlineNodes, translationMode, walkId, toggle))
        consecutiveInlineNodes = []
      }
    }
  }
  else {
    const promises: Promise<void>[] = []
    for (const child of element.childNodes) {
      if (isHTMLElement(child)) {
        promises.push(translateWalkedElement(child, walkId, translationMode, toggle))
      }
    }
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          promises.push(translateWalkedElement(child, walkId, translationMode, toggle))
        }
      }
    }
  }
  // This simultaneously ensures that when concurrent translation
  // and external await call this function, all translations are completed
  await Promise.all(promises)
}
