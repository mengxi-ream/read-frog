import type { APICallError } from 'ai'
import type { Config } from '@/types/config/config'
import type { TranslationMode, TranslationNodeStyleConfig } from '@/types/config/translate'
import type { Point, TransNode } from '@/types/dom'
import React from 'react'
import textSmallCSS from '@/assets/tailwind/text-small.css?inline'
import themeCSS from '@/assets/tailwind/theme.css?inline'
import { TranslationError } from '@/components/translation/error'
import { Spinner } from '@/components/translation/spinner'
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
import { FORCE_INLINE_TRANSLATION_TAGS } from '../../constants/dom-rules'
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

// Helper function to check if content is purely numeric
function isNumericContent(text: string): boolean {
  // Remove whitespace and check if remaining content is numeric
  // Allow numbers, decimals, commas, and common numeric separators
  const cleanedText = text.trim()
  if (!cleanedText)
    return false

  // Pattern matches numbers with optional thousand separators and decimal points
  // Examples: "123", "1,234", "1,234.56", "1 234", "1.234,56" (European format)
  const numericPattern = /^[\d\s,.-]+$/
  if (!numericPattern.test(cleanedText))
    return false

  // Additional check: ensure there's at least one digit
  return /\d/.test(cleanedText)
}

export async function removeOrShowNodeTranslation(point: Point, config: Config) {
  const node = findNearestAncestorBlockNodeAt(point)

  if (!node || !isHTMLElement(node))
    return

  if (!validateTranslationConfig({
    providersConfig: config.providersConfig,
    translate: config.translate,
    language: config.language,
  })) {
    return
  }

  const id = crypto.randomUUID()
  walkAndLabelElement(node, id, config)
  await translateWalkedElement(node, id, config, true)
}

export function removeAllTranslatedWrapperNodes(
  root: Document | ShadowRoot = document,
) {
  const translatedNodes = deepQueryTopLevelSelector(root, isTranslatedWrapperNode)
  translatedNodes.forEach((contentWrapperNode) => {
    removeTranslatedWrapperWithRestore(contentWrapperNode)
  })
}

export async function translateNodes(nodes: ChildNode[], walkId: string, toggle: boolean = false, config: Config, forceBlockTranslation: boolean = false) {
  const translationMode = config.translate.mode
  if (translationMode === 'translationOnly') {
    await translateNodeTranslationOnlyMode(nodes, walkId, config, toggle)
  }
  else if (translationMode === 'bilingual') {
    await translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
  }
}

export async function translateNodesBilingualMode(nodes: ChildNode[], walkId: string, config: Config, toggle: boolean = false, forceBlockTranslation: boolean = false) {
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

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(targetNode, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        nodes.forEach(node => translatingNodes.delete(node))
        void translateNodesBilingualMode(nodes, walkId, config, toggle)
        return
      }
    }

    const textContent = transNodes.map(node => extractTextContent(node, config)).join(' ').trim()
    if (!textContent || isNumericContent(textContent))
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

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)

    const translatedText = realTranslatedText === textContent ? '' : realTranslatedText

    if (!translatedText) {
      // Only remove wrapper if translation returned empty (not needed),
      // but keep it for error display (undefined)
      if (translatedText === '') {
        translatedWrapperNode.remove()
      }
      return
    }

    await insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      targetNode,
      translatedText,
      config.translate.translationNodeStyle,
      forceBlockTranslation,
    )
  }
  finally {
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}

export async function translateNodeTranslationOnlyMode(nodes: ChildNode[], walkId: string, config: Config, toggle: boolean = false) {
  const isTransNodeAndNotTranslatedWrapper = (node: Node): node is TransNode => {
    if (isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS))
      return false
    return isTransNode(node)
  }

  const outerTransNodes = nodes.filter(isTransNode)
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
    allChildNodes = Array.from(unwrappedHTMLChild.childNodes)
    transNodes = allChildNodes.filter(isTransNodeAndNotTranslatedWrapper)
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
    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(targetNode.parentElement, walkId)
    const existedTranslatedWrapperOutside = targetNode.parentElement.closest(`.${CONTENT_WRAPPER_CLASS}`)

    const finalTranslatedWrapper = existedTranslatedWrapperOutside ?? existedTranslatedWrapper
    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
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
        void translateNodeTranslationOnlyMode(nodes, walkId, config, toggle)
        return
      }
    }

    const innerTextContent = transNodes.map(node => extractTextContent(node, config)).join(' ')
    if (!innerTextContent.trim() || isNumericContent(innerTextContent))
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

function findPreviousTranslatedWrapperInside(node: Element | Text, walkId: string): HTMLElement | null {
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

function addInlineTranslation(ownerDoc: Document, translatedWrapperNode: HTMLElement, translatedNode: HTMLElement) {
  const spaceNode = ownerDoc.createElement('span')
  spaceNode.textContent = '  '
  translatedWrapperNode.appendChild(spaceNode)
  translatedNode.className = `${NOTRANSLATE_CLASS} ${INLINE_CONTENT_CLASS}`
}

function addBlockTranslation(ownerDoc: Document, translatedWrapperNode: HTMLElement, translatedNode: HTMLElement) {
  const brNode = ownerDoc.createElement('br')
  translatedWrapperNode.appendChild(brNode)
  translatedNode.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
}

function isForceInlineTranslation(targetNode: TransNode) {
  if (isHTMLElement(targetNode)) {
    const computedStyle = window.getComputedStyle(targetNode)
    return FORCE_INLINE_TRANSLATION_TAGS.has(targetNode.tagName) || computedStyle.display.includes('flex')
  }
  return false
}

async function insertTranslatedNodeIntoWrapper(
  translatedWrapperNode: HTMLElement,
  targetNode: TransNode,
  translatedText: string,
  translationNodeStyle: TranslationNodeStyleConfig,
  forceBlockTranslation: boolean = false,
) {
  // Use the wrapper's owner document
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const translatedNode = ownerDoc.createElement('span')
  const forceInlineTranslation = isForceInlineTranslation(targetNode)

  // priority: forceInlineTranslation > forceBlockTranslation > isInlineTransNode > isBlockTransNode
  if (forceInlineTranslation) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (forceBlockTranslation) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (isInlineTransNode(targetNode)) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (isBlockTransNode(targetNode)) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else {
    // not inline or block, maybe notranslate
    return
  }

  translatedNode.textContent = translatedText
  await decorateTranslationNode(translatedNode, translationNodeStyle)
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

export async function translateWalkedElement(
  element: HTMLElement,
  walkId: string,
  config: Config,
  toggle: boolean = false,
) {
  if (!toggle && element.querySelector(`.${CONTENT_WRAPPER_CLASS}`))
    return

  // if the walkId is not the same, return
  if (element.getAttribute(WALKED_ATTRIBUTE) !== walkId)
    return

  const promises: Promise<void>[] = []

  if (element.hasAttribute(PARAGRAPH_ATTRIBUTE)) {
    let hasBlockNodeChild = false

    for (const child of element.childNodes) {
      if (isHTMLElement(child) && child.hasAttribute(BLOCK_ATTRIBUTE)) {
        hasBlockNodeChild = true
        break
      }
    }

    const computedStyle = window.getComputedStyle(element)
    const isFlexParent = computedStyle.display.includes('flex')

    if (!hasBlockNodeChild) {
      promises.push(translateNodes([element], walkId, toggle, config))
    }
    else {
      // prevent children change during iteration
      const children = Array.from(element.childNodes)
      let consecutiveInlineNodes: ChildNode[] = []
      for (const child of children) {
        if (isTransNode(child) && isBlockTransNode(child) && !isTextNode(child)) {
          // force the children to be block translation style unless the parent is a flex parent
          promises.push(translateNodes(consecutiveInlineNodes, walkId, toggle, config, !isFlexParent))
          consecutiveInlineNodes = []
          promises.push(translateWalkedElement(child, walkId, config, toggle))
        }
        else {
          consecutiveInlineNodes.push(child)
        }
      }

      if (consecutiveInlineNodes.length) {
        promises.push(translateNodes(consecutiveInlineNodes, walkId, toggle, config, !isFlexParent))
        consecutiveInlineNodes = []
      }
    }
  }
  else {
    const promises: Promise<void>[] = []
    for (const child of element.childNodes) {
      if (isHTMLElement(child)) {
        promises.push(translateWalkedElement(child, walkId, config, toggle))
      }
    }
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          promises.push(translateWalkedElement(child, walkId, config, toggle))
        }
      }
    }
  }
  // This simultaneously ensures that when concurrent translation
  // and external await call this function, all translations are completed
  await Promise.all(promises)
}
