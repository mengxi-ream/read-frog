import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { logger } from "@/utils/logger"
import {
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  TRANSLATION_ONLY_ATTRIBUTE,
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
  dropTranslationOnlySwapRecordsForNodes,
  dropVirtualParagraphWrapper,
  removeOrphanVirtualParagraphWrappers,
  removeTranslatedWrapperWithRestore,
  restoreTranslationOnlySwapsForAnchor,
} from "../dom/translation-cleanup"
import { protectTranslationHtmlAttributes } from "../dom/translation-html-attributes"
import { insertTranslatedNodeIntoWrapper } from "../dom/translation-insertion"
import {
  applyInPlaceTextSwap,
  planInPlaceTextSwap,
  snapshotSourceTextNodes,
  verifySourceSnapshot,
} from "../dom/translation-text-swap"
import { findPreviousTranslatedWrapperInside } from "../dom/translation-wrapper"
import { insertVirtualParagraphWrappers } from "../dom/virtual-paragraph-insertion"
import { shouldFilterSmallParagraph } from "../filter-small-paragraph"
import { isHtmlAttributeMarkerIntegrityError } from "../html-attribute-markers"
import { shouldSkipAsTargetLanguage } from "../target-language-skip"
import { normalizeForComparison } from "../text-preparation"
import { translateTextForPage } from "../translate-variants"
import { setTranslationDirAndLang } from "../translation-attributes"
import { createSpinnerInside, getTranslatedTextAndRemoveSpinner } from "../ui/spinner"
import { isNumericContent } from "../ui/translation-utils"
import {
  attachBilingualTranslationWrapper,
  collectSourceTextExcludingWrappers,
  getBilingualTranslationStateForSource,
  getTranslationOnlyAnchorState,
  getVirtualParagraphGroupForSource,
  isBilingualTranslationStateCurrent,
  isVirtualParagraphGroupCurrent,
  markExtensionDrivenNodeRemoval,
  markVirtualParagraphGroupInserted,
  registerBilingualTranslationState,
  registerTranslationOnlyOriginals,
  registerVirtualParagraphGroup,
  registerVirtualParagraphWrapper,
  translatingNodes,
  unregisterBilingualTranslationState,
  type BilingualTranslationState,
  type VirtualParagraphGroup,
  type VirtualParagraphSourceSnapshot,
} from "./translation-state"

let virtualParagraphGroupSequence = 0
const unsupportedDeepLXHtmlAttributeProviders = new Set<string>()
const supportedDeepLXHtmlAttributeProviders = new Set<string>()
type DeepLXHtmlAttributeProbeResult = "supported" | "unsupported" | "unknown"
interface DeepLXHtmlAttributeProbe {
  promise: Promise<DeepLXHtmlAttributeProbeResult>
  resolve: (result: DeepLXHtmlAttributeProbeResult) => void
}
const deepLXHtmlAttributeProbes = new Map<string, DeepLXHtmlAttributeProbe>()

function createDeepLXHtmlAttributeProbe(): DeepLXHtmlAttributeProbe {
  let resolve!: (result: DeepLXHtmlAttributeProbeResult) => void
  const promise = new Promise<DeepLXHtmlAttributeProbeResult>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function finishDeepLXHtmlAttributeProbe(
  providerKey: string,
  probe: DeepLXHtmlAttributeProbe | undefined,
  result: DeepLXHtmlAttributeProbeResult,
): void {
  if (!probe || deepLXHtmlAttributeProbes.get(providerKey) !== probe) return
  deepLXHtmlAttributeProbes.delete(providerKey)
  probe.resolve(result)
}

async function acquireDeepLXHtmlAttributeProbe(providerKey: string): Promise<{
  probe?: DeepLXHtmlAttributeProbe
  useLegacy: boolean
}> {
  while (true) {
    if (unsupportedDeepLXHtmlAttributeProviders.has(providerKey)) {
      return { useLegacy: true }
    }
    if (supportedDeepLXHtmlAttributeProviders.has(providerKey)) {
      return { useLegacy: false }
    }

    const activeProbe = deepLXHtmlAttributeProbes.get(providerKey)
    if (!activeProbe) {
      const probe = createDeepLXHtmlAttributeProbe()
      deepLXHtmlAttributeProbes.set(providerKey, probe)
      return { probe, useLegacy: false }
    }

    // An empty/skipped request or a transient error proves neither support nor
    // incompatibility. Re-enter the loop so exactly one waiter owns the next probe.
    await activeProbe.promise
  }
}

function getDeepLXHtmlAttributeProviderKey(config: Config): string | undefined {
  const providerConfig = resolveProviderConfig(config, "translate")
  if (providerConfig.provider !== "deeplx") return undefined
  return `${providerConfig.id}:${providerConfig.baseURL ?? ""}`
}

function getDisplayTranslation(
  sourceText: string,
  translatedText: string | undefined,
  comparisonText: string | undefined = translatedText,
) {
  if (translatedText === undefined) {
    return undefined
  }

  // comparisonText lets the HTML-marker path (#1832) compare a normalized
  // variant while the raw translatedText is what gets displayed; the folding
  // normalization (#1835) applies on top for both paths.
  return normalizeForComparison(sourceText) === normalizeForComparison(comparisonText)
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
      if (await shouldFilterSmallParagraph(unit.text, config)) return false
      return !(await shouldSkipAsTargetLanguage(unit.text, config))
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
    sourceTextContent: collectSourceTextExcludingWrappers(layoutSource),
    wrapperPlacements: new Map(),
  }
  registerVirtualParagraphGroup(group)

  const sourceTextSnapshot = collectSourceTextExcludingWrappers(layoutSource)
  let includedUnits: VirtualParagraphUnit[]
  try {
    includedUnits = await filterVirtualParagraphUnits(units, config)
  } catch (error) {
    disposeVirtualParagraphGroup(group)
    throw error
  }

  if (
    !isVirtualParagraphGroupCurrent(group) ||
    collectSourceTextExcludingWrappers(layoutSource) !== sourceTextSnapshot
  ) {
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

    // After a translationOnly session, an in-place-swapped paragraph has no
    // wrapper — only the anchor marker. A bilingual toggle over it must undo
    // the swap (and a bilingual translate must see the original text).
    const swappedAnchor = (
      isHTMLElement(insertionTarget) ? insertionTarget : insertionTarget.parentElement
    )?.closest<HTMLElement>(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)
    if (
      swappedAnchor &&
      restoreTranslationOnlySwapsForAnchor(swappedAnchor, transNodes) &&
      toggle
    ) {
      return
    }

    const sourceTextBeforeFilter = isHTMLElement(layoutSource)
      ? collectSourceTextExcludingWrappers(layoutSource)
      : null
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
      // Target-language skip runs here, BEFORE the wrapper/spinner is inserted,
      // so same-language paragraphs never touch the DOM.
      shouldFilter =
        (await shouldFilterSmallParagraph(textContent, config)) ||
        (await shouldSkipAsTargetLanguage(textContent, config))
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

/**
 * A run's own translationOnly wrapper, scoped to the run: the insertion code
 * only ever places the wrapper as a sibling within the run or appends it into
 * a single-element run, so nested runs' wrappers (a li's inside this run's
 * subtree) are out of reach by construction.
 */
function findRunTranslationOnlyWrapper(
  allChildNodes: ChildNode[],
  walkId: string,
): HTMLElement | null {
  // Any-mode wrapper: a bilingual wrapper here is this run's own previous
  // translation too (node-level translate, then a mode switch, then toggle).
  const isForeignWrapper = (element: HTMLElement) =>
    element.classList.contains(CONTENT_WRAPPER_CLASS) &&
    element.getAttribute(WALKED_ATTRIBUTE) !== walkId

  for (const node of allChildNodes) {
    if (!isHTMLElement(node)) continue
    if (isForeignWrapper(node)) return node
    // Spinner phase of a single-element run: wrapper appended INSIDE it
    for (const child of node.children) {
      if (isHTMLElement(child) && isForeignWrapper(child)) return child
    }
  }
  return null
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
    // The run may be nothing but a fallback wrapper whose originals were
    // displaced (e.g. a <li> holding only the translation). Its toggle must
    // still restore, so handle the wrapper before giving up on the run.
    const runWrappers = allChildNodes.filter(
      (node): node is HTMLElement =>
        isHTMLElement(node) &&
        node.classList.contains(CONTENT_WRAPPER_CLASS) &&
        node.getAttribute(TRANSLATION_MODE_ATTRIBUTE) ===
          ("translationOnly" satisfies TranslationMode) &&
        node.getAttribute(WALKED_ATTRIBUTE) !== walkId,
    )
    if (runWrappers.length === 0) return
    const restored: ChildNode[] = []
    for (const wrapper of runWrappers) {
      restored.push(...removeTranslatedWrapperWithRestore(wrapper))
    }
    if (!toggle) {
      const retryNodes = restored.filter((node) => node.isConnected)
      if (retryNodes.length > 0) {
        void translateNodeTranslationOnlyMode(retryNodes, walkId, config, toggle)
      }
    }
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
    // An in-place swap leaves no wrapper — the anchor marker is the handle.
    // Restore FIRST (before any wrapper handling): a swapped run must undo its
    // own swap, never let an unrelated nested run's wrapper stand in for it.
    // Also runs before the filter/language checks below so they (and a
    // retranslation) see original text, not the previous translation.
    // Non-toggle (retranslation) keeps the records registered so the anchor
    // stays monitored through the provider round-trip — a re-swap dropped by
    // the mid-flight snapshot guard must not leave the region unwatched.
    const swapAnchor = parentNode.closest<HTMLElement>(`[${TRANSLATION_ONLY_ATTRIBUTE}]`)
    const restoredOwnSwap = swapAnchor
      ? restoreTranslationOnlySwapsForAnchor(
          swapAnchor,
          transNodes,
          toggle ? undefined : { keepRecords: true },
        )
      : false

    // Own-run wrapper discovery is scoped to the run itself: the fallback
    // wrapper is always inserted as a sibling within the run or appended into
    // a single-element run — a deep subtree query would steal a NESTED run's
    // wrapper (e.g. a li's) and leave this run's state untouched (#1846 review).
    const existedTranslatedWrapperOutside = targetNode.parentElement.closest(
      `.${CONTENT_WRAPPER_CLASS}`,
    )
    const finalTranslatedWrapper =
      existedTranslatedWrapperOutside ?? findRunTranslationOnlyWrapper(allChildNodes, walkId)
    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      const restoredNodes = removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
      if (toggle) {
        return
      }
      // The restore synchronously re-inserted the SAME original node objects,
      // so when `nodes` are still connected they remain the correct
      // retranslation input. When they referenced the removed wrapper or its
      // translated content (both detached now), retranslate the restored
      // originals instead. Neither side connected means the host rebuilt the
      // region — leave it alone rather than loop.
      nodes.forEach((node) => translatingNodes.delete(node))
      const retryNodes = nodes.some((node) => node.isConnected)
        ? nodes
        : restoredNodes.filter((node) => node.isConnected)
      if (retryNodes.length > 0) {
        void translateNodeTranslationOnlyMode(retryNodes, walkId, config, toggle)
      }
      return
    }

    if (restoredOwnSwap && toggle) {
      return
    }

    const innerTextContent = transNodes.map((node) => extractTextContent(node, config)).join("")
    if (!innerTextContent.trim() || isNumericContent(innerTextContent)) return

    if (await shouldFilterSmallParagraph(innerTextContent, config)) return

    // Check the plain text, not the HTML string sent to the provider — franc
    // on markup is noise. Runs before the wrapper is inserted into the DOM.
    if (await shouldSkipAsTargetLanguage(innerTextContent, config)) return

    const ownerDoc = getOwnerDocument(targetNode)
    const protectedHtml = protectTranslationHtmlAttributes(transNodes, ownerDoc)
    const textContent = protectedHtml.sourceHtml
    if (!textContent) return

    // Taken before the provider request; the response handler compares against
    // it to detect host mutations that happened while the request was in
    // flight (never swap over content the host has since rewritten).
    const sourceSnapshot = snapshotSourceTextNodes(transNodes)

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
    const deepLXProviderKey = getDeepLXHtmlAttributeProviderKey(config)
    const translateLegacyHtml = async () => {
      const translatedHtml = await translateTextForPage(protectedHtml.legacyRequestHtml, "html")
      return translatedHtml ? protectedHtml.restoreLegacy(translatedHtml) : translatedHtml
    }
    const translateRequest = async () => {
      if (!protectedHtml.hasPlaceholders) return translateLegacyHtml()

      let ownedDeepLXProbe: DeepLXHtmlAttributeProbe | undefined
      if (deepLXProviderKey) {
        const probeDecision = await acquireDeepLXHtmlAttributeProbe(deepLXProviderKey)
        if (probeDecision.useLegacy) return translateLegacyHtml()
        ownedDeepLXProbe = probeDecision.probe
      }

      try {
        const translatedHtml = await translateTextForPage(protectedHtml.requestHtml, "html")
        if (!translatedHtml) {
          if (deepLXProviderKey) {
            finishDeepLXHtmlAttributeProbe(deepLXProviderKey, ownedDeepLXProbe, "unknown")
          }
          return translatedHtml
        }

        const restoredHtml = protectedHtml.restore(translatedHtml)
        if (deepLXProviderKey) {
          supportedDeepLXHtmlAttributeProviders.add(deepLXProviderKey)
          finishDeepLXHtmlAttributeProbe(deepLXProviderKey, ownedDeepLXProbe, "supported")
        }
        return restoredHtml
      } catch (error) {
        if (!isHtmlAttributeMarkerIntegrityError(error)) {
          if (deepLXProviderKey) {
            finishDeepLXHtmlAttributeProbe(deepLXProviderKey, ownedDeepLXProbe, "unknown")
          }
          throw error
        }

        if (deepLXProviderKey) {
          unsupportedDeepLXHtmlAttributeProviders.add(deepLXProviderKey)
          supportedDeepLXHtmlAttributeProviders.delete(deepLXProviderKey)
          finishDeepLXHtmlAttributeProbe(deepLXProviderKey, ownedDeepLXProbe, "unsupported")
        }
        logger.warn("HTML attribute placeholders were not preserved; retrying full HTML", error)
        return translateLegacyHtml()
      }
    }

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
      nodes,
      textContent,
      spinner,
      translatedWrapperNode,
      () => true,
      "html",
      translateRequest,
    )
    const translatedText = realTranslatedText
      ? getDisplayTranslation(
          protectedHtml.comparisonSourceHtml,
          realTranslatedText,
          protectedHtml.normalizeForComparison(realTranslatedText),
        )
      : realTranslatedText

    if (!translatedText) {
      // Keep the wrapper when translation failed so the injected error UI remains visible.
      // Only remove the wrapper when translation returned an empty string.
      if (translatedText === "") {
        markExtensionDrivenNodeRemoval(translatedWrapperNode)
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    // Preferred strategy: swap the translation into the site's OWN text nodes,
    // leaving element identity (framework fibers, listeners) untouched. The
    // wrapper was only the spinner vehicle and is removed.
    const swapPlan = planInPlaceTextSwap(transNodes, translatedText, ownerDoc)
    if (swapPlan) {
      batchDOMOperation(() => {
        // Wrapper gone: a global cleanup ran while the provider call was in
        // flight, or the host re-rendered the region — leave originals alone.
        if (!translatedWrapperNode.isConnected) return
        markExtensionDrivenNodeRemoval(translatedWrapperNode)
        translatedWrapperNode.remove()
        // Host mutated the run mid-flight: the translation is stale, drop it.
        // Any kept (restore-first) records still reference the run, so the
        // staleness pipeline retries with the host's fresh text.
        if (!verifySourceSnapshot(transNodes, sourceSnapshot)) return
        applyInPlaceTextSwap(
          swapPlan,
          transNodes,
          parentNode,
          walkId,
          config,
          getTranslationOnlyAnchorState,
        )
      })
      return
    }

    // Fallback strategy: render into the wrapper and displace the originals,
    // retaining the node objects so restore can re-insert the same nodes (#1846).
    translatedWrapperNode.innerHTML = translatedText

    // Batch final DOM mutations to reduce layout thrashing
    batchDOMOperation(() => {
      // Wrapper gone from the document: a global cleanup ran while the provider
      // call was in flight, or the host re-rendered the region. The originals
      // are the live content — don't remove them to apply a stale translation.
      if (!translatedWrapperNode.isConnected) return

      // Insert translated content after the last node
      const lastChildNode = allChildNodes.at(-1)!
      lastChildNode.parentNode?.insertBefore(translatedWrapperNode, lastChildNode.nextSibling)

      registerTranslationOnlyOriginals(translatedWrapperNode, allChildNodes)
      allChildNodes.forEach((childNode) => childNode.remove())
      // The wrapper now owns this run; kept swap records (restore-first
      // retranslation) would reference displaced nodes and read as
      // permanently stale — drop them.
      if (swapAnchor) dropTranslationOnlySwapRecordsForNodes(swapAnchor, transNodes)
    })
  } finally {
    nodes.forEach((node) => translatingNodes.delete(node))
  }
}
