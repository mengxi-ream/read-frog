import type { Point, TransNode } from '@/types/dom'
import React from 'react'
import { TranslationError } from '@/components/tranlation-error'
import { cleanupAllReactWrappers, createReactComponentWrapper } from '@/utils/render-react-component'
import { globalConfig } from '../../config/config'
import { FORCE_INLINE_TRANSLATION_TAGS } from '../../constants/dom'
import {
  BLOCK_CONTENT_CLASS,
  CONSECUTIVE_INLINE_END_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from '../../constants/translation'
import { isBlockTransNode, isHTMLElement, isInlineTransNode, isTextNode } from '../dom/filter'
import {
  extractTextContent,
  findNearestBlockNodeAt,
  translateWalkedElement,
  unwrapDeepestOnlyHTMLChild,
  walkAndLabelElement,
} from '../dom/traversal'
import { translateText } from './translate-text'

const translatingNodes = new Set<HTMLElement | Text>()

// Store which documents already have styles injected
const documentsWithStyles = new WeakSet<Document>()

/**
 * Get the document that owns the given node
 */
function getOwnerDocument(node: Node): Document {
  return node.ownerDocument || document
}

/**
 * Check if the node is inside an iframe and inject necessary styles
 */
function ensureStylesInjected(node: TransNode) {
  const ownerDoc = getOwnerDocument(node)

  // If this is the main document or we've already injected styles, skip
  if (ownerDoc === document || documentsWithStyles.has(ownerDoc)) {
    return
  }

  // Mark this document as having styles
  documentsWithStyles.add(ownerDoc)

  // Create and inject the necessary styles
  const styleElement = ownerDoc.createElement('style')
  styleElement.textContent = `
    :root {
      --read-frog-primary: oklch(76.5% 0.177 163.223);
      --read-frog-muted: oklch(0.97 0 0);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --read-frog-primary: oklch(59.6% 0.145 163.225);
        --read-frog-muted: oklch(0.269 0 0);
      }
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .read-frog-spinner {
      border: 3px solid var(--read-frog-muted);
      border-top: 3px solid var(--read-frog-primary);
      border-radius: 50%;
      width: 6px;
      height: 6px;
      margin: 0 4px;
      animation: spin 1s linear infinite;
      display: inline-block;
      vertical-align: middle;
      box-sizing: content-box;
    }

    .read-frog-translated-content-wrapper {
      word-break: break-word;
      user-select: text;
    }

    .read-frog-translated-block-content {
      display: inline-block;
      margin: 8px 0 !important;
      color: inherit;
      font-family: inherit;
    }

    .read-frog-translated-inline-content {
      display: inline;
      color: inherit;
      font-family: inherit;
      text-decoration: inherit;
    }
  `

  // Insert the style element into the head
  const head = ownerDoc.head || ownerDoc.documentElement
  if (head) {
    head.appendChild(styleElement)
  }
}

export async function hideOrShowNodeTranslation(point: Point) {
  if (!globalConfig)
    return

  const node = findNearestBlockNodeAt(point)

  if (!node || !isHTMLElement(node) || !node.textContent?.trim())
    return

  const id = crypto.randomUUID()
  walkAndLabelElement(node, id)
  await translateWalkedElement(node, id, true)
}

export async function hideOrShowPageTranslation(toggle: boolean = false) {
  const id = crypto.randomUUID()

  walkAndLabelElement(document.body, id)
  await translateWalkedElement(document.body, id, toggle)
}

export function removeAllTranslatedWrapperNodes(
  root: Document | ShadowRoot = document,
) {
  function removeFromRoot(root: Document | ShadowRoot) {
    const translatedNodes = root.querySelectorAll(
      `.${NOTRANSLATE_CLASS}.${CONTENT_WRAPPER_CLASS}`,
    )
    translatedNodes.forEach((node) => {
      // Clean up any React components before removing the node
      cleanupAllReactWrappers(node as Element)
      node.remove()
    })

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

    // Ensure styles are injected if this node is in an iframe
    ensureStylesInjected(node)

    const targetNode
      = isHTMLElement(node) ? unwrapDeepestOnlyHTMLChild(node) : node

    const existedTranslatedWrapper = findExistedTranslatedWrapper(targetNode)
    if (existedTranslatedWrapper) {
      existedTranslatedWrapper.remove()
      if (toggle) {
        return
      }
    }

    const textContent = extractTextContent(targetNode)
    if (!textContent)
      return

    // Use the node's owner document instead of main document
    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    const spinner = ownerDoc.createElement('span')
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

    const translatedText = await getTranslatedTextAndRemoveSpinner(node, textContent, spinner, translatedWrapperNode)

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

    // Ensure styles are injected if this node is in an iframe
    ensureStylesInjected(targetNode)

    const existedTranslatedWrapper = findExistedTranslatedWrapper(targetNode)
    if (existedTranslatedWrapper) {
      existedTranslatedWrapper.remove()
      if (toggle) {
        return
      }
    }

    const textContent = nodes.map(node => extractTextContent(node)).join(' ')
    if (!textContent)
      return

    // Use the node's owner document instead of main document
    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement('span')
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    const spinner = ownerDoc.createElement('span')
    spinner.className = 'read-frog-spinner'
    translatedWrapperNode.appendChild(spinner)

    targetNode.parentNode?.insertBefore(
      translatedWrapperNode,
      targetNode.nextSibling,
    )

    const translatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)

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

async function getTranslatedTextAndRemoveSpinner(node: TransNode | TransNode[], textContent: string, spinner: HTMLElement, translatedWrapperNode: HTMLElement) {
  let translatedText: string | undefined

  try {
    translatedText = await translateText(textContent)
  }
  catch (error) {
    spinner.remove()

    const errorComponent = React.createElement(TranslationError, {
      node,
      error: error as Error,
    })
    const { container, cleanup } = createReactComponentWrapper(errorComponent, 'read-frog-error-wrapper')

    // Store cleanup function on the container for later use
    ;(container as any).__reactCleanup = cleanup

    translatedWrapperNode.appendChild(container)
  }
  finally {
    if (spinner.parentNode) {
      spinner.remove()
    }
  }

  return translatedText
}
