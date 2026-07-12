import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import {
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  VIRTUAL_PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { batchDOMOperation } from "../../dom/batch-dom"
import { isBlockTransNode, isHTMLElement, isTextNode, isTransNode } from "../../dom/filter"
import { unwrapDeepestOnlyHTMLChild } from "../../dom/find"
import { getOwnerDocument } from "../../dom/node"
import { extractTextContent } from "../../dom/traversal"
import { buildVirtualParagraphPlan, type VirtualParagraphUnit } from "../dom/paragraph-segmentation"
import {
  disposeVirtualParagraphGroup,
  dropVirtualParagraphWrapper,
  removeOrphanVirtualParagraphWrappers,
  removeTranslatedWrapperWithRestore,
} from "../dom/translation-cleanup"
import { insertTranslatedNodeIntoWrapper } from "../dom/translation-insertion"
import { findPreviousTranslatedWrapperInside } from "../dom/translation-wrapper"
import { insertVirtualParagraphWrappers } from "../dom/virtual-paragraph-insertion"
import { shouldFilterSmallParagraph } from "../filter-small-paragraph"
import { prepareTranslationText } from "../text-preparation"
import { setTranslationDirAndLang } from "../translation-attributes"
import { createSpinnerInside, getTranslatedTextAndRemoveSpinner } from "../ui/spinner"
import { isNumericContent } from "../ui/translation-utils"
import {
  attachBilingualTranslationWrapper,
  getBilingualTranslationStateForSource,
  getVirtualParagraphGroupForSource,
  isBilingualTranslationStateCurrent,
  isVirtualParagraphGroupCurrent,
  MARK_ATTRIBUTES_REGEX,
  markVirtualParagraphGroupInserted,
  originalContentMap,
  registerBilingualTranslationState,
  registerVirtualParagraphGroup,
  registerVirtualParagraphWrapper,
  translatingNodes,
  unregisterBilingualTranslationState,
  type BilingualTranslationState,
  type VirtualParagraphGroup,
  type VirtualParagraphSourceSnapshot,
} from "./translation-state"

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
let virtualParagraphGroupSequence = 0

function getDisplayTranslation(sourceText: string, translatedText: string | undefined) {
  if (translatedText === undefined) {
    return undefined
  }

  return prepareTranslationText(sourceText) === prepareTranslationText(translatedText)
    ? ""
    : translatedText
}

function createBilingualWrapper(
  ownerDoc: Document,
  walkId: string,
  config: Config,
  virtualParagraphId?: string,
): { spinner: HTMLElement; wrapper: HTMLElement } {
  const wrapper = ownerDoc.createElement("span")
  wrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
  wrapper.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual" satisfies TranslationMode)
  wrapper.setAttribute(WALKED_ATTRIBUTE, walkId)
  if (virtualParagraphId) {
    wrapper.setAttribute(VIRTUAL_PARAGRAPH_ATTRIBUTE, virtualParagraphId)
  }
  setTranslationDirAndLang(wrapper, config)
  return { spinner: createSpinnerInside(wrapper), wrapper }
}

async function filterVirtualParagraphUnits(
  units: VirtualParagraphUnit[],
  config: Config,
): Promise<VirtualParagraphUnit[]> {
  const included = await Promise.all(
    units.map(async (unit) => {
      if (isNumericContent(unit.text)) return false
      return !(await shouldFilterSmallParagraph(unit.text, config))
    }),
  )
  return units.filter((_, index) => included[index])
}

async function translateVirtualParagraph(
  entry: ReturnType<typeof insertVirtualParagraphWrappers>["inserted"][number],
  spinner: HTMLElement,
  group: VirtualParagraphGroup,
  nodes: ChildNode[],
  config: Config,
  forceBlockTranslation: boolean,
): Promise<void> {
  const { flowSource, unit, wrapper } = entry
  const isCurrent = () => isVirtualParagraphGroupCurrent(group, wrapper)
  if (!isCurrent()) return

  const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
    nodes,
    unit.text,
    spinner,
    wrapper,
    isCurrent,
  )
  if (!isCurrent()) {
    disposeVirtualParagraphGroup(group)
    return
  }

  const translatedText = getDisplayTranslation(unit.text, realTranslatedText)
  if (translatedText === "") {
    dropVirtualParagraphWrapper(group, wrapper)
    return
  }
  if (translatedText === undefined) {
    if (!wrapper.querySelector(`.${TRANSLATION_ERROR_CONTAINER_CLASS}`)) {
      dropVirtualParagraphWrapper(group, wrapper)
    }
    return
  }

  await insertTranslatedNodeIntoWrapper(
    wrapper,
    { flowSource, isCurrent, layoutSource: group.layoutSource },
    translatedText,
    config.translate.translationNodeStyle,
    config,
    forceBlockTranslation,
  )
  if (!isCurrent()) disposeVirtualParagraphGroup(group)
}

async function translateVirtualParagraphs(
  nodes: ChildNode[],
  units: VirtualParagraphUnit[],
  sourceSnapshots: VirtualParagraphSourceSnapshot[],
  layoutSource: HTMLElement,
  walkId: string,
  config: Config,
  forceBlockTranslation: boolean,
): Promise<void> {
  const group: VirtualParagraphGroup = {
    id: `${walkId}:${virtualParagraphGroupSequence++}`,
    walkId,
    status: "active",
    layoutSource,
    wrappers: new Set(),
    splitRecords: [],
    sourceSnapshots,
    sourceTextContent: layoutSource.textContent ?? "",
    wrapperPlacements: new Map(),
  }
  registerVirtualParagraphGroup(group)

  const sourceTextSnapshot = layoutSource.textContent
  let includedUnits: VirtualParagraphUnit[]
  try {
    includedUnits = await filterVirtualParagraphUnits(units, config)
  } catch (error) {
    disposeVirtualParagraphGroup(group)
    throw error
  }

  if (!isVirtualParagraphGroupCurrent(group) || layoutSource.textContent !== sourceTextSnapshot) {
    disposeVirtualParagraphGroup(group)
    return
  }
  if (includedUnits.length === 0) {
    disposeVirtualParagraphGroup(group)
    return
  }

  const ownerDoc = getOwnerDocument(layoutSource)
  const spinners = new Map<HTMLElement, HTMLElement>()
  const entries = includedUnits.map((unit) => {
    const { spinner, wrapper } = createBilingualWrapper(
      ownerDoc,
      walkId,
      config,
      `${group.id}:${unit.id}`,
    )
    spinners.set(wrapper, spinner)
    registerVirtualParagraphWrapper(group, wrapper)
    return { unit, wrapper }
  })

  let inserted: ReturnType<typeof insertVirtualParagraphWrappers>["inserted"]
  try {
    ;({ inserted } = insertVirtualParagraphWrappers(entries, layoutSource, group.splitRecords))
  } catch (error) {
    disposeVirtualParagraphGroup(group)
    throw error
  }

  markVirtualParagraphGroupInserted(group)
  if (!isVirtualParagraphGroupCurrent(group)) {
    disposeVirtualParagraphGroup(group)
    return
  }

  await Promise.allSettled(
    inserted.map((entry) =>
      translateVirtualParagraph(
        entry,
        spinners.get(entry.wrapper)!,
        group,
        nodes,
        config,
        forceBlockTranslation,
      ),
    ),
  )
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
  } else if (translationMode === "bilingual") {
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
  const transNodes = nodes.filter((node) => isTransNode(node))
  if (transNodes.length === 0) {
    return
  }

  const layoutSource = transNodes.at(-1)!
  const virtualLayoutSource =
    transNodes.length === 1 && isHTMLElement(layoutSource) && isBlockTransNode(layoutSource)
      ? layoutSource
      : undefined

  if (virtualLayoutSource) {
    const existingGroup = getVirtualParagraphGroupForSource(virtualLayoutSource)
    if (existingGroup) {
      const isSameActiveWalk =
        existingGroup.walkId === walkId && isVirtualParagraphGroupCurrent(existingGroup)
      if (!toggle && isSameActiveWalk) return

      disposeVirtualParagraphGroup(existingGroup)
      if (toggle) return

      // A previous generation may still be awaiting its provider. Its group
      // ownership guard prevents stale writes, so the fresh walk can proceed.
      transNodes.forEach((node) => translatingNodes.delete(node))
    } else if (removeOrphanVirtualParagraphWrappers(virtualLayoutSource) && toggle) {
      return
    }
  }

  if (isHTMLElement(layoutSource)) {
    const existingBilingualState = getBilingualTranslationStateForSource(layoutSource)
    if (existingBilingualState) {
      const isSameActiveWalk =
        existingBilingualState.walkId === walkId &&
        isBilingualTranslationStateCurrent(existingBilingualState)
      if (!toggle && isSameActiveWalk) return

      if (existingBilingualState.wrapper) {
        removeTranslatedWrapperWithRestore(existingBilingualState.wrapper)
      } else {
        unregisterBilingualTranslationState(existingBilingualState)
      }
      if (toggle) return
      transNodes.forEach((node) => translatingNodes.delete(node))
    }
  }

  try {
    // prevent duplicate translation
    if (transNodes.every((node) => translatingNodes.has(node))) {
      return
    }
    transNodes.forEach((node) => translatingNodes.add(node))

    if (virtualLayoutSource) {
      const virtualParagraphPlan = buildVirtualParagraphPlan(virtualLayoutSource, config)
      if (virtualParagraphPlan.units.length >= 2) {
        await translateVirtualParagraphs(
          nodes,
          virtualParagraphPlan.units,
          virtualParagraphPlan.sourceSnapshots,
          virtualLayoutSource,
          walkId,
          config,
          forceBlockTranslation,
        )
        return
      }
    }

    const insertionTarget =
      transNodes.length === 1 && isBlockTransNode(layoutSource) && isHTMLElement(layoutSource)
        ? unwrapDeepestOnlyHTMLChild(layoutSource, config)
        : layoutSource

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(insertionTarget, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      nodes.forEach((node) => translatingNodes.delete(node))
      return translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
    }

    const sourceTextBeforeFilter = isHTMLElement(layoutSource) ? layoutSource.textContent : null
    const textContent = transNodes
      .map((node) => extractTextContent(node, config))
      .join("")
      .trim()
    if (!textContent || isNumericContent(textContent)) return

    let bilingualState: BilingualTranslationState | undefined
    if (isHTMLElement(layoutSource) && sourceTextBeforeFilter !== null) {
      bilingualState = {
        layoutSource,
        sourceTextContent: sourceTextBeforeFilter,
        status: "active",
        walkId,
        wrapper: null,
      }
      registerBilingualTranslationState(bilingualState)
    }

    let shouldFilter: boolean
    try {
      shouldFilter = await shouldFilterSmallParagraph(textContent, config)
    } catch (error) {
      if (bilingualState) unregisterBilingualTranslationState(bilingualState)
      throw error
    }

    if (bilingualState && !isBilingualTranslationStateCurrent(bilingualState)) {
      const shouldRetry =
        getBilingualTranslationStateForSource(layoutSource as HTMLElement) === bilingualState &&
        layoutSource.isConnected
      unregisterBilingualTranslationState(bilingualState)
      if (shouldRetry) {
        nodes.forEach((node) => translatingNodes.delete(node))
        return translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation)
      }
      return
    }
    if (shouldFilter) {
      if (bilingualState) unregisterBilingualTranslationState(bilingualState)
      return
    }

    const ownerDoc = getOwnerDocument(insertionTarget)
    const { spinner, wrapper: translatedWrapperNode } = createBilingualWrapper(
      ownerDoc,
      walkId,
      config,
    )

    if (isTextNode(insertionTarget) || transNodes.length > 1) {
      insertionTarget.parentNode?.insertBefore(translatedWrapperNode, insertionTarget.nextSibling)
    } else {
      insertionTarget.appendChild(translatedWrapperNode)
    }

    if (isHTMLElement(layoutSource) && layoutSource.contains(translatedWrapperNode)) {
      if (bilingualState) {
        attachBilingualTranslationWrapper(bilingualState, translatedWrapperNode)
      }
    } else if (bilingualState) {
      unregisterBilingualTranslationState(bilingualState)
      bilingualState = undefined
    }
    const isCurrent = () =>
      bilingualState
        ? isBilingualTranslationStateCurrent(bilingualState)
        : translatedWrapperNode.isConnected

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
      nodes,
      textContent,
      spinner,
      translatedWrapperNode,
      isCurrent,
    )

    if (!isCurrent()) {
      removeTranslatedWrapperWithRestore(translatedWrapperNode)
      return
    }

    const translatedText = getDisplayTranslation(textContent, realTranslatedText)

    if (translatedText === "") {
      removeTranslatedWrapperWithRestore(translatedWrapperNode)
      return
    }
    if (translatedText === undefined) {
      if (!translatedWrapperNode.querySelector(`.${TRANSLATION_ERROR_CONTAINER_CLASS}`)) {
        removeTranslatedWrapperWithRestore(translatedWrapperNode)
      }
      return
    }

    await insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      { flowSource: insertionTarget, isCurrent, layoutSource },
      translatedText,
      config.translate.translationNodeStyle,
      config,
      forceBlockTranslation,
    )
    if (!isCurrent()) removeTranslatedWrapperWithRestore(translatedWrapperNode)
  } finally {
    transNodes.forEach((node) => translatingNodes.delete(node))
  }
}

export async function translateNodeTranslationOnlyMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
): Promise<void> {
  const isTransNodeAndNotTranslatedWrapper = (node: Node): node is TransNode => {
    if (isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS)) return false
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
    const unwrappedHTMLChild = unwrapDeepestOnlyHTMLChild(outerTransNodes[0], config)
    allChildNodes = [...unwrappedHTMLChild.childNodes]
    transNodes = allChildNodes.filter(isTransNodeAndNotTranslatedWrapper)
  } else {
    transNodes = outerTransNodes
    allChildNodes = nodes
  }

  if (transNodes.length === 0) {
    return
  }

  try {
    if (nodes.every((node) => translatingNodes.has(node))) {
      return
    }
    nodes.forEach((node) => translatingNodes.add(node))

    const targetNode = transNodes.at(-1)!

    const parentNode = targetNode.parentElement
    if (!parentNode) {
      console.error("targetNode.parentElement is not HTMLElement", targetNode.parentElement)
      return
    }
    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(
      targetNode.parentElement,
      walkId,
    )
    const existedTranslatedWrapperOutside = targetNode.parentElement.closest(
      `.${CONTENT_WRAPPER_CLASS}`,
    )

    const finalTranslatedWrapper = existedTranslatedWrapperOutside ?? existedTranslatedWrapper
    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
      if (toggle) {
        return
      }
      // In translationOnly mode, removeTranslatedWrapperWithRestore uses innerHTML to restore content,
      // which destroys the original DOM nodes and creates new ones. The 'nodes' array still references
      // the old detached nodes, and targetNode can't reference to the new dom added by innerHTML anymore.
      // Therefore, by recursively calling translateNodeTranslationOnlyMode here with the
      // same nodes array, we ensure the translation uses the newly created DOM elements since the
      // function will re-query and find the correct parent and child nodes from the restored DOM.
      nodes.forEach((node) => translatingNodes.delete(node))
      void translateNodeTranslationOnlyMode(nodes, walkId, config, toggle)
      return
    }

    const innerTextContent = transNodes.map((node) => extractTextContent(node, config)).join("")
    if (!innerTextContent.trim() || isNumericContent(innerTextContent)) return

    if (await shouldFilterSmallParagraph(innerTextContent, config)) return

    const cleanTextContent = (content: string): string => {
      if (!content) return content

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
    if (!textContent) return

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(
      TRANSLATION_MODE_ATTRIBUTE,
      "translationOnly" satisfies TranslationMode,
    )
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    translatedWrapperNode.style.display = "contents"
    setTranslationDirAndLang(translatedWrapperNode, config)
    const spinner = createSpinnerInside(translatedWrapperNode)

    // Batch DOM insertion to reduce layout thrashing
    const insertOperation = () => {
      if (isTextNode(targetNode) || transNodes.length > 1) {
        targetNode.parentNode?.insertBefore(translatedWrapperNode, targetNode.nextSibling)
      } else {
        targetNode.appendChild(translatedWrapperNode)
      }
    }
    batchDOMOperation(insertOperation)

    // The source string mixes text nodes with element outerHTML and the result
    // is re-rendered via innerHTML, so providers must treat it as HTML to keep
    // its tags intact.
    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
      nodes,
      textContent,
      spinner,
      translatedWrapperNode,
      () => true,
      "html",
    )
    const translatedText = realTranslatedText
      ? getDisplayTranslation(textContent, realTranslatedText)
      : realTranslatedText

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
      allChildNodes.forEach((childNode) => childNode.remove())
    })
  } finally {
    nodes.forEach((node) => translatingNodes.delete(node))
  }
}
