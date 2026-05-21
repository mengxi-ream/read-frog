import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  TRANSLATION_MODE_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { batchDOMOperation } from "../../dom/batch-dom"
import { isBlockTransNode, isCustomForceBlockTranslation, isHTMLElement, isInlineTransNode, isTextNode, isTransNode } from "../../dom/filter"
import { unwrapDeepestOnlyHTMLChild } from "../../dom/find"
import { getOwnerDocument } from "../../dom/node"
import { extractTextContent } from "../../dom/traversal"
import { removeTranslatedWrapperWithRestore } from "../dom/translation-cleanup"
import { insertTranslatedNodeIntoWrapper } from "../dom/translation-insertion"
import { findPreviousTranslatedWrapperInside } from "../dom/translation-wrapper"
import { shouldFilterSmallParagraph } from "../filter-small-paragraph"
import { prepareTranslationText } from "../text-preparation"
import { setTranslationDirAndLang } from "../translation-attributes"
import { decorateTranslationNode } from "../ui/decorate-translation"
import { createSpinnerInside, getTranslatedTextAndRemoveSpinner } from "../ui/spinner"
import { isForceInlineTranslation, isNumericContent } from "../ui/translation-utils"
import { buildLineByLineBatchText, parseLineByLineBatchResult } from "./line-by-line-utils"
import { segmentSentences } from "./segment-sentences"
import { MARK_ATTRIBUTES_REGEX, originalContentMap, translatingNodes } from "./translation-state"

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g

function getDisplayTranslation(sourceText: string, translatedText: string | undefined) {
  if (translatedText === undefined) {
    return undefined
  }

  return prepareTranslationText(sourceText) === prepareTranslationText(translatedText)
    ? ""
    : translatedText
}

export async function translateNodes(
  nodes: ChildNode[],
  walkId: string,
  toggle: boolean = false,
  config: Config,
  forceBlockTranslation: boolean = false,
): Promise<void> {
  const translationMode = config.translate.mode
  if (translationMode === "translationOnly") {
    await translateNodeTranslationOnlyMode(nodes, walkId, config, toggle)
  }
  else if (translationMode === "lineByLine") {
    await translateNodesLineByLineMode(nodes, walkId, config, toggle, forceBlockTranslation)
  }
  else if (translationMode === "bilingual") {
    await translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
  }
}

export async function translateNodesBilingualMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceBlockTranslation: boolean = false,
): Promise<void> {
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

    const lastNode = transNodes.at(-1)!
    const targetNode
      = transNodes.length === 1 && isBlockTransNode(lastNode) && isHTMLElement(lastNode)
        ? await unwrapDeepestOnlyHTMLChild(lastNode)
        : lastNode

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

    const textContent = transNodes.map(node => extractTextContent(node, config)).join("").trim()
    if (!textContent || isNumericContent(textContent))
      return

    if (await shouldFilterSmallParagraph(textContent, config))
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    setTranslationDirAndLang(translatedWrapperNode, config)
    const spinner = createSpinnerInside(translatedWrapperNode)

    // Batch DOM insertion to reduce layout thrashing
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(translatedWrapperNode)
      }
    }
    batchDOMOperation(insertOperation)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)

    const translatedText = getDisplayTranslation(textContent, realTranslatedText)

    if (!translatedText) {
      // Only remove wrapper if translation returned empty (not needed),
      // but keep it for error display (undefined)
      if (translatedText === "") {
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
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

// ── Line-by-line helpers ────────────────────────────────────────────

function findParagraphElement(node: Node): HTMLElement | null {
  const element = isHTMLElement(node) ? node : node.parentElement
  return element?.closest<HTMLElement>(`[${PARAGRAPH_ATTRIBUTE}]`) ?? null
}

function removeLineByLineTranslation(paragraphElement: HTMLElement): void {
  const savedHTML = originalContentMap.get(paragraphElement)
  if (savedHTML !== undefined) {
    paragraphElement.innerHTML = savedHTML
    originalContentMap.delete(paragraphElement)
  }
  paragraphElement.removeAttribute(TRANSLATION_MODE_ATTRIBUTE)
  paragraphElement.removeAttribute(WALKED_ATTRIBUTE)
}

// ── Line-by-line mode ──────────────────────────────────────────────

export async function translateNodesLineByLineMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceBlockTranslation: boolean = false,
): Promise<void> {
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

    const lastNode = transNodes.at(-1)!
    const targetNode
      = transNodes.length === 1 && isBlockTransNode(lastNode) && isHTMLElement(lastNode)
        ? await unwrapDeepestOnlyHTMLChild(lastNode)
        : lastNode

    // Check for existing line-by-line translation via paragraph attributes
    const paragraphElement = findParagraphElement(targetNode)
    const alreadyTranslated = paragraphElement
      && paragraphElement.getAttribute(TRANSLATION_MODE_ATTRIBUTE) === "lineByLine"
      && paragraphElement.getAttribute(WALKED_ATTRIBUTE) === walkId

    if (alreadyTranslated && paragraphElement) {
      removeLineByLineTranslation(paragraphElement)
      if (toggle) {
        return
      }
      else {
        nodes.forEach(node => translatingNodes.delete(node))
        void translateNodesLineByLineMode(nodes, walkId, config, toggle, forceBlockTranslation)
        return
      }
    }

    const textContent = transNodes.map(node => extractTextContent(node, config)).join("").trim()
    if (!textContent || isNumericContent(textContent))
      return

    if (await shouldFilterSmallParagraph(textContent, config))
      return

    // Segment into sentences
    const sentences = segmentSentences(textContent)

    // Single sentence → delegate to bilingual mode
    if (sentences.length <= 1) {
      transNodes.forEach(node => translatingNodes.delete(node))
      return translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
    }

    // Build batch text with %% separators
    const batchText = buildLineByLineBatchText(sentences)

    // Create temporary spinner wrapper (same placement as bilingual wrapper)
    const ownerDoc = getOwnerDocument(targetNode)
    const spinnerWrapper = ownerDoc.createElement("span")
    spinnerWrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    spinnerWrapper.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "lineByLine" satisfies TranslationMode)
    spinnerWrapper.setAttribute(WALKED_ATTRIBUTE, walkId)
    setTranslationDirAndLang(spinnerWrapper, config)
    const spinner = createSpinnerInside(spinnerWrapper)

    // Insert spinner beside paragraph
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(
          spinnerWrapper,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(spinnerWrapper)
      }
    }
    batchDOMOperation(insertOperation)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
      nodes,
      batchText,
      spinner,
      spinnerWrapper,
    )

    // Error: spinner replaced with error component — keep wrapper, abort
    if (realTranslatedText === undefined) {
      return
    }

    // Success: remove the temporary spinner wrapper
    spinnerWrapper.remove()

    // Empty result — nothing to display
    if (realTranslatedText === "") {
      return
    }

    // Parse translated sentences
    const translatedSentences = parseLineByLineBatchResult(realTranslatedText)

    // Count mismatch → fallback to bilingual mode
    if (translatedSentences.length !== sentences.length) {
      transNodes.forEach(node => translatingNodes.delete(node))
      return translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
    }

    // Save original content snapshot for restore
    const targetParagraph = paragraphElement ?? (isHTMLElement(targetNode) ? targetNode : targetNode.parentElement)
    if (targetParagraph && !originalContentMap.has(targetParagraph)) {
      originalContentMap.set(targetParagraph, targetParagraph.innerHTML)
    }

    // Mark paragraph as line-by-line translated
    if (targetParagraph) {
      targetParagraph.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "lineByLine" satisfies TranslationMode)
      targetParagraph.setAttribute(WALKED_ATTRIBUTE, walkId)
    }

    // Determine block vs inline style — same priority chain as bilingual
    const forceInline = isForceInlineTranslation(targetNode)
    const customForceBlock = isHTMLElement(targetNode) && isCustomForceBlockTranslation(targetNode)

    let isBlock: boolean
    if (customForceBlock) {
      isBlock = true
    }
    else if (forceInline) {
      isBlock = false
    }
    else if (forceBlockTranslation) {
      isBlock = true
    }
    else if (isInlineTransNode(targetNode)) {
      isBlock = false
    }
    else if (isBlockTransNode(targetNode)) {
      isBlock = true
    }
    else {
      // Neither inline nor block — shouldn't happen for trans nodes, but bail
      return
    }

    // Rebuild paragraph DOM with interleaved sentences
    const fragment = ownerDoc.createDocumentFragment()

    for (let i = 0; i < sentences.length; i++) {
      // Original sentence — display:contents so layout is unchanged
      const origSpan = ownerDoc.createElement("span")
      origSpan.style.display = "contents"
      origSpan.textContent = sentences[i]
      fragment.appendChild(origSpan)

      // Translation sentence
      const transSpan = ownerDoc.createElement("span")
      transSpan.className = `${NOTRANSLATE_CLASS} ${isBlock ? BLOCK_CONTENT_CLASS : INLINE_CONTENT_CLASS}`
      transSpan.textContent = translatedSentences[i]
      await decorateTranslationNode(transSpan, config.translate.translationNodeStyle)
      fragment.appendChild(transSpan)
    }

    // Replace paragraph content
    if (targetParagraph) {
      targetParagraph.innerHTML = ""
      targetParagraph.appendChild(fragment)
    }
  }
  finally {
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}

export async function translateNodeTranslationOnlyMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
): Promise<void> {
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
  // Only save originalContent when there's no existing translation wrapper
  // If wrapper exists, we're removing translation and should restore from saved content
  const outerParentElement = outerTransNodes[0].parentElement
  const hasExistingWrapper = outerParentElement?.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
  if (outerParentElement && !originalContentMap.has(outerParentElement) && !hasExistingWrapper) {
    originalContentMap.set(outerParentElement, outerParentElement.innerHTML)
  }

  let transNodes: TransNode[] = []
  let allChildNodes: ChildNode[] = []
  if (outerTransNodes.length === 1 && isHTMLElement(outerTransNodes[0])) {
    const unwrappedHTMLChild = await unwrapDeepestOnlyHTMLChild(outerTransNodes[0])
    allChildNodes = [...unwrappedHTMLChild.childNodes]
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

    const targetNode = transNodes.at(-1)!

    const parentNode = targetNode.parentElement
    if (!parentNode) {
      console.error("targetNode.parentElement is not HTMLElement", targetNode.parentElement)
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

    const innerTextContent = transNodes.map(node => extractTextContent(node, config)).join("")
    if (!innerTextContent.trim() || isNumericContent(innerTextContent))
      return

    if (await shouldFilterSmallParagraph(innerTextContent, config))
      return

    const cleanTextContent = (content: string): string => {
      if (!content)
        return content

      let cleanedContent = content.replace(MARK_ATTRIBUTES_REGEX, "")
      cleanedContent = cleanedContent.replace(HTML_COMMENT_RE, " ")

      return cleanedContent
    }

    // Only save originalContent when there's no existing translation wrapper
    const hasExistingWrapperInParent = parentNode.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    if (!originalContentMap.has(parentNode) && !hasExistingWrapperInParent) {
      originalContentMap.set(parentNode, parentNode.innerHTML)
    }

    const getStringFormatFromNode = (node: Element | Text) => {
      if (isTextNode(node)) {
        return node.textContent
      }
      return node.outerHTML
    }

    const textContent = cleanTextContent(transNodes.map(getStringFormatFromNode).join(""))
    if (!textContent)
      return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    translatedWrapperNode.style.display = "contents"
    setTranslationDirAndLang(translatedWrapperNode, config)
    const spinner = createSpinnerInside(translatedWrapperNode)

    // Batch DOM insertion to reduce layout thrashing
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(translatedWrapperNode)
      }
    }
    batchDOMOperation(insertOperation)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode)
    const translatedText = realTranslatedText ? getDisplayTranslation(textContent, realTranslatedText) : realTranslatedText

    if (!translatedText) {
      // Keep the wrapper when translation failed so the injected error UI remains visible.
      // Only remove the wrapper when translation returned an empty string.
      if (translatedText === "") {
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    translatedWrapperNode.innerHTML = translatedText

    // Batch final DOM mutations to reduce layout thrashing
    batchDOMOperation(() => {
      // Insert translated content after the last node
      const lastChildNode = allChildNodes.at(-1)!
      lastChildNode.parentNode?.insertBefore(translatedWrapperNode, lastChildNode.nextSibling)

      // Remove all original nodes
      allChildNodes.forEach(childNode => childNode.remove())
    })
  }
  finally {
    nodes.forEach(node => translatingNodes.delete(node))
  }
}
