import type { Config } from '@/types/config/config'
import type { Point, TransNode } from '@/types/dom'
import { globalConfig } from '../config/config'
import { FORCE_INLINE_TRANSLATION_TAGS } from '../constants/dom'
import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from '../constants/translation'
import { isBlockTransNode, isHTMLElement, isInlineTransNode, isTextNode } from './dom/filter'
import {
  extractTextContent,
  findNearestBlockNodeAt,
  translateWalkedElement,
  unwrapDeepestOnlyChild,
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

export async function translatePage() {
  const id = crypto.randomUUID()

  walkAndLabelElement(document.body, id)
  translateWalkedElement(document.body, id)
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
    if (translatingNodes.has(node))
      return
    translatingNodes.add(node)

    const targetNode
      = isHTMLElement(node) ? unwrapDeepestOnlyChild(node) : node

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

    const translatedWrapperNode = document.createElement('div')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.style.display = 'block'
    translatedWrapperNode.style.position = 'static'
    translatedWrapperNode.style.clear = 'both'
    translatedWrapperNode.style.width = '100%'
    translatedWrapperNode.style.maxWidth = '100%'
    translatedWrapperNode.style.overflow = 'visible'
    translatedWrapperNode.style.whiteSpace = 'normal'
    translatedWrapperNode.style.boxSizing = 'border-box'

    const spinner = document.createElement('span')
    spinner.className = 'read-frog-spinner'
    translatedWrapperNode.appendChild(spinner)

    if (isHTMLElement(targetNode)) {
      targetNode.appendChild(translatedWrapperNode)
    }
    else if (isTextNode(targetNode)) {
      if (targetNode.parentNode) {
        targetNode.parentNode.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
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

function findExistedTranslatedWrapper(node: TransNode) {
  if (isTextNode(node)) {
    let nextSibling = node.nextSibling
    while (nextSibling) {
      if (isHTMLElement(nextSibling) && nextSibling.classList.contains(NOTRANSLATE_CLASS)) {
        return nextSibling
      }
      nextSibling = nextSibling.nextSibling
    }
  }
  else if (isHTMLElement(node)) {
    const wrappers = node.querySelectorAll(`.${NOTRANSLATE_CLASS}.${CONTENT_WRAPPER_CLASS}`)
    if (wrappers.length > 0) {
      return wrappers[0] as HTMLElement
    }
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

  translatedWrapperNode.style.display = 'block'
  translatedWrapperNode.style.position = 'static'
  translatedWrapperNode.style.clear = 'both'
  translatedWrapperNode.style.width = '100%'
  translatedWrapperNode.style.maxWidth = '100%'
  translatedWrapperNode.style.overflow = 'visible'
  translatedWrapperNode.style.boxSizing = 'border-box'
  translatedWrapperNode.style.margin = '0'
  translatedWrapperNode.style.padding = '0'

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
    return
  }

  translatedNode.textContent = translatedText
  translatedNode.style.display = 'block'
  translatedNode.style.position = 'static'
  translatedNode.style.float = 'none'
  translatedNode.style.clear = 'both'
  translatedNode.style.width = '100%'
  translatedNode.style.maxWidth = '100%'
  translatedNode.style.overflow = 'visible'
  translatedNode.style.whiteSpace = 'normal'
  translatedNode.style.textOverflow = 'clip'
  translatedNode.style.wordWrap = 'break-word'
  translatedNode.style.wordBreak = 'normal'
  translatedNode.style.boxSizing = 'border-box'

  if (window.location.hostname.includes('medium.com')) {
    translatedNode.style.fontStyle = 'normal'
    translatedNode.style.transform = 'none'
  }

  translatedWrapperNode.appendChild(translatedNode)
}

export async function shouldAutoEnable(url: string, config: Config): Promise<boolean> {
  const autoTranslatePatterns = config?.translate.page.autoTranslatePatterns
  if (!autoTranslatePatterns)
    return false

  return autoTranslatePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
}
