import type { Config } from '@/types/config/config'
import type { Point, TransNode } from '@/types/dom'
import { globalConfig } from '../config/config'
import { FORCE_INLINE_TRANSLATION_TAGS } from '../constants/dom'
import {
  BLOCK_CONTENT_CLASS,
  CONSECUTIVE_INLINE_END_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from '../constants/translation'
import { isBlockTransNode, isHTMLElement, isInlineTransNode, isTextNode } from './dom/filter'
import {
  extractTextContent,
  findNearestBlockNodeAt,
  translateWalkedElement,
  unwrapDeepestOnlyHTMLChild,
  walkAndLabelElement,
} from './dom/traversal'
import { translateText } from './translate-text'

const translatingNodes = new Set<HTMLElement | Text>()

export function hideOrShowNodeTranslation(point: Point) {
  if (!globalConfig)
    return

  const node = findNearestBlockNodeAt(point)

  if (!node || !isHTMLElement(node) || !shouldTriggerAction(node))
    return

  const id = crypto.randomUUID()
  walkAndLabelElement(node, id)
  translateWalkedElement(node, id, true)
}

function shouldTriggerAction(node: Node) {
  return node.textContent?.trim()
}

export async function hideOrShowPageTranslation(toggle: boolean = false) {
  const id = crypto.randomUUID()

  walkAndLabelElement(document.body, id)
  translateWalkedElement(document.body, id, toggle)
}

export function removeAllTranslatedWrapperNodes(
  root: Document | ShadowRoot = document,
) {
  function removeFromRoot(root: Document | ShadowRoot) {
    const translatedNodes = root.querySelectorAll(
      `.${NOTRANSLATE_CLASS}.${CONTENT_WRAPPER_CLASS}`,
    )
    translatedNodes.forEach(node => node.remove())

    // Recursively search through shadow roots
    root.querySelectorAll('*').forEach((element) => {
      if (isHTMLElement(element) && element.shadowRoot) {
        removeFromRoot(element.shadowRoot)
      }
    })
  }

  removeFromRoot(root)
}

/**
 * Translate the node
 * @param node - The node to translate
 * @param toggle - Whether to toggle the translation, if true, the translation will be removed if it already exists
 */
export async function translateNode(node: TransNode, toggle: boolean = false) {
  try {
    // prevent duplicate translation
    if (translatingNodes.has(node))
      return
    translatingNodes.add(node)

    const targetNode
      = isHTMLElement(node) ? unwrapDeepestOnlyHTMLChild(node) : node

    const existedTranslatedWrapper = findExistedTranslatedWrapper(targetNode)
    if (existedTranslatedWrapper) {
      if (toggle) {
        existedTranslatedWrapper.remove()
      }
      return
    }

    const textContent = extractTextContent(targetNode)
    if (!textContent)
      return

    const translatedWrapperNode = document.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    const spinner = document.createElement('span')
    spinner.className = 'read-frog-spinner'
    translatedWrapperNode.appendChild(spinner)

    if (isTextNode(targetNode)) {
      targetNode.parentNode?.insertBefore(
        translatedWrapperNode,
        targetNode.nextSibling,
      )
    }
    else {
      targetNode.appendChild(translatedWrapperNode)
    }

    let translatedText: string | undefined
    try {
      translatedText = await translateText(textContent)
    }
    catch (error) {
      logger.error(error)
      translatedWrapperNode.remove()
    }
    finally {
      spinner.remove()
    }

    if (!translatedText)
      return

    insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      targetNode,
      translatedText,
    )
  }
  finally {
    translatingNodes.delete(node)
  }
}

export async function translateConsecutiveInlineNodes(nodes: TransNode[], toggle: boolean = false) {
  try {
    // if translatingNodes has all nodes, return
    if (nodes.every(node => translatingNodes.has(node))) {
      return
    }
    nodes.forEach(node => translatingNodes.add(node))

    const targetNode = nodes[nodes.length - 1]
    const existedTranslatedWrapper = findExistedTranslatedWrapper(targetNode)
    if (existedTranslatedWrapper) {
      if (toggle) {
        existedTranslatedWrapper.remove()
      }
      return
    }

    const textContent = nodes.map(node => extractTextContent(node)).join(' ')
    if (!textContent)
      return

    const translatedWrapperNode = document.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    const spinner = document.createElement('span')
    spinner.className = 'read-frog-spinner'
    translatedWrapperNode.appendChild(spinner)

    targetNode.parentNode?.insertBefore(
      translatedWrapperNode,
      targetNode.nextSibling,
    )

    let translatedText: string | undefined
    try {
      translatedText = await translateText(textContent)
    }
    catch (error) {
      logger.error(error)
      translatedWrapperNode.remove()
    }
    finally {
      spinner.remove()
    }

    if (!translatedText)
      return

    insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      targetNode,
      translatedText,
    )
  }
  catch (error) {
    logger.error(error)
  }
  finally {
    nodes.forEach(node => translatingNodes.delete(node))
  }
}

function findExistedTranslatedWrapper(node: TransNode) {
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
  const translatedNode = document.createElement('span')
  const isForceInlineTranslationElement
    = isHTMLElement(targetNode)
      && FORCE_INLINE_TRANSLATION_TAGS.has(targetNode.tagName)

  if (isForceInlineTranslationElement || isInlineTransNode(targetNode)) {
    const spaceNode = document.createElement('span')
    spaceNode.textContent = '  '
    translatedWrapperNode.appendChild(spaceNode)
    translatedNode.className = `${NOTRANSLATE_CLASS} ${INLINE_CONTENT_CLASS}`
  }
  else if (isBlockTransNode(targetNode)) {
    const brNode = document.createElement('br')
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

export async function shouldAutoEnable(url: string, config: Config): Promise<boolean> {
  const autoTranslatePatterns = config?.translate.page.autoTranslatePatterns
  if (!autoTranslatePatterns)
    return false

  return autoTranslatePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
}
