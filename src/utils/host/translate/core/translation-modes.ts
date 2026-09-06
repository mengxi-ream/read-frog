import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import { logger } from "@/utils/logger"
import { resolvePageTranslationProvider } from "@/utils/providers/provider-ref"
import {
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  TRANSLATION_ONLY_ATTRIBUTE,
  VIRTUAL_PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import {
  GIANT_PARAGRAPH_SPLIT_MIN_VIEWPORT_PX,
  GIANT_PARAGRAPH_SPLIT_VIEWPORT_MULTIPLIER,
} from "../../../constants/translate"
import { batchDOMOperation } from "../../dom/batch-dom"
import {
  isBlockTransNode,
  isHTMLElement,
  isNaturalBlockTransNode,
  isSiteRuleForceBlockStyleElement,
  isTextNode,
  isTransNode,
} from "../../dom/filter"
import { unwrapDeepestOnlyHTMLChild } from "../../dom/find"
import { getOwnerDocument } from "../../dom/node"
import { canSplitGiantWithoutStrandingOwnText, extractTextContent } from "../../dom/traversal"
import {
  containsInlineAtomOutsideWrappers,
  extractInlineAtomText,
  renderInlineAtomTranslation,
} from "../dom/inline-atoms"
import {
  buildVirtualParagraphPlan,
  canMaterializeVirtualParagraphUnits,
  isNewlinePreservingElement,
  moveParagraphInsertionBoundaryAfterTrailingInlineImages,
  type VirtualParagraphUnit,
} from "../dom/paragraph-segmentation"
import {
  disposeVirtualParagraphGroup,
  dropTranslationOnlySwapRecordsForNodes,
  dropVirtualParagraphWrapper,
  removeOrphanVirtualParagraphWrappers,
  removeTranslatedWrapperWithRestore,
  restoreTranslationOnlySwapsForAnchor,
  teardownVirtualTranslationOnlyGeneration,
} from "../dom/translation-cleanup"
import { protectTranslationHtmlAttributes } from "../dom/translation-html-attributes"
import { insertTranslatedNodeIntoWrapper } from "../dom/translation-insertion"
import {
  applyInPlaceTextSwap,
  ensureTranslationOnlyAnchorState,
  planInPlaceTextSwap,
  snapshotSourceTextNodes,
  verifySourceSnapshot,
} from "../dom/translation-text-swap"
import { findPreviousTranslatedWrapperInside } from "../dom/translation-wrapper"
import {
  insertVirtualParagraphWrappers,
  materializeVirtualParagraphUnitRuns,
} from "../dom/virtual-paragraph-insertion"
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
  countWrapperTamperRepair,
  getBilingualTranslationStateForSource,
  getTranslationOnlyAnchorState,
  getVirtualParagraphGroupForSource,
  isBilingualTranslationStateCurrent,
  isBilingualWrapperContentTampered,
  isVirtualParagraphGroupCurrent,
  markExtensionDrivenNodeRemoval,
  markVirtualParagraphGroupInserted,
  MAX_WRAPPER_TAMPER_REPAIRS,
  registerBilingualTranslationState,
  registerTranslationOnlyOriginals,
  registerVirtualParagraphGroup,
  registerVirtualParagraphWrapper,
  resetWrapperTamperRepairs,
  translatingNodes,
  unregisterBilingualTranslationState,
  type BilingualTranslationState,
  type VirtualParagraphGroup,
  type VirtualParagraphSourceSnapshot,
} from "./translation-state"

let virtualParagraphGroupSequence = 0
let virtualTranslationOnlyGenerationSequence = 0
const unsupportedDeepLXHtmlAttributeProviders = new Set<string>()
const supportedDeepLXHtmlAttributeProviders = new Set<string>()
type DeepLXHtmlAttributeProbeResult = "supported" | "unsupported" | "unknown"
interface DeepLXHtmlAttributeProbe {
  promise: Promise<DeepLXHtmlAttributeProbeResult>
  resolve: (result: DeepLXHtmlAttributeProbeResult) => void
}
const deepLXHtmlAttributeProbes = new Map<string, DeepLXHtmlAttributeProbe>()

function translateTextForAction(
  text: string,
  textFormat: "plain" | "html",
  forceRetranslation: boolean = false,
): Promise<string> {
  return translateTextForPage(text, textFormat, { forceRetranslation })
}

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
  const resolved = resolvePageTranslationProvider(config)
  if (resolved.kind === "system" || resolved.config.provider !== "deeplx") {
    return undefined
  }
  return `${resolved.config.id}:${resolved.config.baseURL ?? ""}`
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
  forceRetranslation: boolean = false,
): Promise<void> {
  const { unit, wrapper } = entry
  const isCurrent = () => isVirtualParagraphGroupCurrent(group, wrapper)
  if (!isCurrent()) return

  const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
    nodes,
    unit.text,
    spinner,
    wrapper,
    isCurrent,
    "plain",
    // Virtual units exist only inside newline-preserving containers, so their
    // interior single newlines (bullet lists) are always semantic.
    () =>
      translateTextForPage(unit.text, "plain", {
        preserveLineBreaks: true,
        forceRetranslation,
      }),
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
    { isCurrent, layoutSource: group.layoutSource, sourceText: unit.text },
    translatedText,
    config.pageTranslation.translationNodeStyle,
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
  forceRetranslation: boolean = false,
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
    ;({ inserted } = insertVirtualParagraphWrappers(entries, group.splitRecords))
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
        forceRetranslation,
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
  forceRetranslation: boolean = false,
): Promise<void> {
  const translationMode = config.pageTranslation.mode
  if (translationMode === "translationOnly") {
    await translateNodeTranslationOnlyMode(nodes, walkId, config, toggle, forceRetranslation)
  } else if (translationMode === "bilingual") {
    await translateNodesBilingualMode(
      nodes,
      walkId,
      config,
      toggle,
      forceBlockTranslation,
      forceRetranslation,
    )
  }
}

export async function translateNodesBilingualMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceBlockTranslation: boolean = false,
  forceRetranslation: boolean = false,
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

      if (!toggle && isBilingualWrapperContentTampered(existingBilingualState)) {
        // The site rewrote our wrapper content while the host text is intact
        // (#1918). Repair by retranslating — but a script that rewrites
        // deterministically would fight forever (the retranslation budget
        // bounds rate, not duration), so after MAX_WRAPPER_TAMPER_REPAIRS
        // losses adopt the site's version as the expected content: the
        // pre-#1918 terminal state, reached after real repair attempts.
        if (countWrapperTamperRepair(layoutSource) > MAX_WRAPPER_TAMPER_REPAIRS) {
          existingBilingualState.wrapperTextContent =
            existingBilingualState.wrapper?.textContent ?? null
          return
        }
      } else {
        // Genuine host change, toggle, or new session: the fight (if any) is
        // over — re-arm the capitulation budget.
        resetWrapperTamperRepairs(layoutSource)
      }

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
      // Virtual unit texts cannot carry inline-atom placeholders (the raw
      // source collector drops atoms behind barriers), so a container that
      // holds a formula stays on the whole-run path below, where the formulas
      // are cloned into the translation. Checked only once a multi-unit plan
      // exists, so ordinary containers pay nothing.
      if (
        virtualParagraphPlan.units.length >= 2 &&
        !containsInlineAtomOutsideWrappers(virtualLayoutSource, config)
      ) {
        // Explicit blank-line boundaries represent block paragraphs even when
        // an individual unit is short enough for the compact-label heuristic.
        await translateVirtualParagraphs(
          nodes,
          virtualParagraphPlan.units,
          virtualParagraphPlan.sourceSnapshots,
          virtualLayoutSource,
          walkId,
          config,
          forceBlockTranslation || isNaturalBlockTransNode(virtualLayoutSource),
          forceRetranslation,
        )
        return
      }
    }

    const shouldUnwrapSingleBlockSource =
      transNodes.length === 1 &&
      isHTMLElement(layoutSource) &&
      (isNaturalBlockTransNode(layoutSource) ||
        (isBlockTransNode(layoutSource) && isSiteRuleForceBlockStyleElement(layoutSource, config)))
    const insertionTarget = shouldUnwrapSingleBlockSource
      ? unwrapDeepestOnlyHTMLChild(layoutSource, config)
      : layoutSource

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(insertionTarget, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      nodes.forEach((node) => translatingNodes.delete(node))
      return translateNodesBilingualMode(
        nodes,
        walkId,
        config,
        toggle,
        forceBlockTranslation,
        forceRetranslation,
      )
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
    // One extraction yields two strings: `textContent` is the prose-only
    // legacy string (atoms contribute "") that every filter below keeps
    // seeing; `requestText` carries a {{n}} placeholder per inline atom
    // (formula) and is what the provider, the echo check and the layout
    // heuristic get. Without atoms the two are byte-identical.
    const atomExtraction = extractInlineAtomText(transNodes, config)
    const textContent = atomExtraction.filterText.trim()
    const requestText = atomExtraction.requestText.trim()
    if (!textContent || isNumericContent(textContent)) return
    // A run whose only content is formulas (an equation cell, a bare
    // display container) has nothing to translate; never send tokens alone.
    if (atomExtraction.atoms.length > 0 && !atomExtraction.hasProse) return

    let bilingualState: BilingualTranslationState | undefined
    if (isHTMLElement(layoutSource) && sourceTextBeforeFilter !== null) {
      bilingualState = {
        layoutSource,
        sourceTextContent: sourceTextBeforeFilter,
        status: "active",
        walkId,
        wrapper: null,
        wrapperTextContent: null,
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
        return translateNodesBilingualMode(
          nodes,
          walkId,
          config,
          toggle,
          forceBlockTranslation,
          forceRetranslation,
        )
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
    let hasTrailingInlineImageAttachment = false

    if (transNodes.length === 1 && isHTMLElement(layoutSource) && isHTMLElement(insertionTarget)) {
      const originalInsertionBoundary = {
        container: insertionTarget,
        offset: insertionTarget.childNodes.length,
      }
      const insertionBoundary = moveParagraphInsertionBoundaryAfterTrailingInlineImages(
        originalInsertionBoundary,
        layoutSource,
      )
      hasTrailingInlineImageAttachment =
        insertionBoundary.container !== originalInsertionBoundary.container ||
        insertionBoundary.offset !== originalInsertionBoundary.offset
      insertionBoundary.container.insertBefore(
        translatedWrapperNode,
        insertionBoundary.container.childNodes[insertionBoundary.offset] ?? null,
      )
    } else if (isTextNode(insertionTarget) || transNodes.length > 1) {
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

    // Newline-preserving containers render single "\n" as real line breaks
    // (an X tweet whose lines have no blank-line separators is ONE unit here,
    // e.g. https://x.com/EpsteinJeffrey0/status/2083709421386080579 — five
    // lines split by single "\n" that Google merged into one run-on line),
    // so the provider must not collapse them. The FLOW CONTAINER's white-space
    // governs how the run's newlines render: for an inline layout source
    // (e.g. a GitHub inline <code> with its own break-spaces inside a normal
    // paragraph) the parent's value is authoritative, not the element's own.
    const flowContainer =
      isHTMLElement(layoutSource) && isBlockTransNode(layoutSource)
        ? layoutSource
        : layoutSource.parentElement
    const preserveLineBreaks = flowContainer ? isNewlinePreservingElement(flowContainer) : false

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(
      nodes,
      requestText,
      spinner,
      translatedWrapperNode,
      isCurrent,
      "plain",
      () =>
        translateTextForPage(requestText, "plain", {
          preserveLineBreaks,
          forceRetranslation,
        }),
    )

    if (!isCurrent()) {
      removeTranslatedWrapperWithRestore(translatedWrapperNode)
      return
    }

    // Compared on the tokenized strings: an echo comes back with its tokens.
    const translatedText = getDisplayTranslation(requestText, realTranslatedText)

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
      {
        isCurrent,
        layoutSource,
        styleSources: transNodes,
        // Wrapper-content integrity snapshot (#1918): armed synchronously at
        // append time so a site rewrite landing during the decorate await can
        // never be canonized as the expected content.
        onContentInserted: (wrapper) => {
          if (bilingualState) bilingualState.wrapperTextContent = wrapper.textContent
        },
        // Inline atoms are cloned into the translated span at their
        // placeholder positions; the tokenized text also stands in for the
        // formulas' visible width in the short-inline layout heuristic.
        renderTranslatedContent:
          atomExtraction.atoms.length > 0
            ? (translatedNode, text) =>
                renderInlineAtomTranslation(translatedNode, text, atomExtraction)
            : undefined,
        sourceText: requestText,
      },
      translatedText,
      config.pageTranslation.translationNodeStyle,
      config,
      forceBlockTranslation || hasTrailingInlineImageAttachment,
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

/**
 * Entry point for translationOnly mode. Picks the granularity — one run for
 * the whole request, or one run per blank-line paragraph — and leaves the
 * translating to `translateTranslationOnlyRun`.
 */
export async function translateNodeTranslationOnlyMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceRetranslation: boolean = false,
): Promise<void> {
  const outerTransNodes = nodes.filter(isTransNode)
  if (outerTransNodes.length === 0) return

  const layoutSource = outerTransNodes[0]!
  const isSingleBlockSource =
    outerTransNodes.length === 1 && isHTMLElement(layoutSource) && isBlockTransNode(layoutSource)
  if (isSingleBlockSource) {
    const handled = await maybeTranslateVirtualUnitRuns(
      layoutSource,
      nodes,
      walkId,
      config,
      toggle,
      forceRetranslation,
    )
    if (handled) return
  }

  return translateTranslationOnlyRun(nodes, walkId, config, toggle, forceRetranslation)
}

/** A container taller than this is what the observer treats as a giant. */
function isGiantParagraphUnit(element: HTMLElement): boolean {
  const maxUnitHeight =
    Math.max(window.innerHeight, GIANT_PARAGRAPH_SPLIT_MIN_VIEWPORT_PX) *
    GIANT_PARAGRAPH_SPLIT_VIEWPORT_MULTIPLIER
  return element.getBoundingClientRect().height > maxUnitHeight
}

/** Labeled paragraphs directly under `container`, with no paragraph in between. */
function collectTopLevelParagraphDescendants(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[${PARAGRAPH_ATTRIBUTE}]`)].filter(
    (paragraph) => {
      const ancestor = paragraph.parentElement?.closest(`[${PARAGRAPH_ATTRIBUTE}]`)
      return !ancestor || ancestor === container || !container.contains(ancestor)
    },
  )
}

/**
 * A giant container whose plan cannot be materialized must NOT collapse into a
 * single request. The observer only hands such a container over whole because
 * the same predicate said its units were materializable; if the host reshaped
 * the DOM in between, translating it as one run would ship a whole 22k-char
 * note tweet in one payload and, on a failed alignment, displace every one of
 * its framework-owned nodes into a wrapper. Translating each labeled paragraph
 * separately reproduces what per-paragraph observation would have done.
 */
async function translateNonMaterializableGiant(
  layoutSource: HTMLElement,
  walkId: string,
  config: Config,
  forceRetranslation: boolean,
): Promise<boolean> {
  if (!isGiantParagraphUnit(layoutSource)) return false
  // Same content guard the observation gate applies: splitting into descendant
  // paragraphs drops the container's own direct text. Falling back to the
  // single run keeps that text rather than silently losing it here, after the
  // observer already refused to lose it.
  if (!canSplitGiantWithoutStrandingOwnText(layoutSource)) return false

  const paragraphs = collectTopLevelParagraphDescendants(layoutSource)
  if (paragraphs.length === 0) return false

  await Promise.allSettled(
    paragraphs.map((paragraph) =>
      translateTranslationOnlyRun([paragraph], walkId, config, false, forceRetranslation),
    ),
  )
  return true
}

/**
 * Translate a newline-preserving container one blank-line paragraph at a time,
 * matching the granularity bilingual mode gets from its virtual-paragraph plan.
 *
 * Each unit becomes a run of whole child nodes and goes through the ordinary
 * per-run pipeline, so every unit gets its own request, its own small-paragraph
 * and target-language filtering, its own spinner and error UI, and its own
 * restore record. Returns false when this container is not one to segment, so
 * the caller falls back to translating the request as a single run.
 */
async function maybeTranslateVirtualUnitRuns(
  layoutSource: HTMLElement,
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean,
  forceRetranslation: boolean,
): Promise<boolean> {
  const previousState = getTranslationOnlyAnchorState(layoutSource)
  const hasPreviousGeneration =
    previousState !== undefined &&
    (previousState.virtualGeneration !== undefined || (previousState.splitRecords?.length ?? 0) > 0)

  if (hasPreviousGeneration) {
    // Rebuild from scratch rather than patching a live generation: a plan built
    // over half-restored text would read our own translations as source and
    // send them back to the provider, and a second round of cuts over the first
    // round's tails could no longer be rejoined.
    teardownVirtualTranslationOnlyGeneration(layoutSource)
    if (toggle) return true
  } else if (
    previousState !== undefined ||
    layoutSource.querySelector(`.${CONTENT_WRAPPER_CLASS}`) !== null
  ) {
    // This container was translated as a single run. Its own path knows how to
    // restore or replace that, and segmenting on top of it would translate our
    // own output.
    return false
  }

  const plan = buildVirtualParagraphPlan(layoutSource, config)
  if (plan.units.length < 2) return false

  if (!canMaterializeVirtualParagraphUnits(layoutSource, plan, config)) {
    return translateNonMaterializableGiant(layoutSource, walkId, config, forceRetranslation)
  }

  if (nodes.every((node) => translatingNodes.has(node))) return true
  nodes.forEach((node) => translatingNodes.add(node))

  try {
    // Claim the anchor before cutting anything: from here on the marker is what
    // lets a page-wide cleanup find these cuts, even if every unit then fails.
    const state = ensureTranslationOnlyAnchorState(
      layoutSource,
      config,
      getTranslationOnlyAnchorState,
    )
    state.splitRecords ??= []
    virtualTranslationOnlyGenerationSequence += 1
    const generation = virtualTranslationOnlyGenerationSequence
    state.virtualGeneration = generation
    const isCurrent = () =>
      getTranslationOnlyAnchorState(layoutSource)?.virtualGeneration === generation

    const runs = materializeVirtualParagraphUnitRuns(layoutSource, plan, config, state.splitRecords)
    if (!runs) {
      // The host reshaped the container between planning and cutting. Undo
      // whatever was cut and let the single-run path have the request.
      teardownVirtualTranslationOnlyGeneration(layoutSource)
      return false
    }

    await Promise.allSettled(
      runs.map((run) =>
        translateTranslationOnlyRun(
          run.nodes,
          walkId,
          config,
          false,
          forceRetranslation,
          isCurrent,
        ),
      ),
    )

    // Queued, not called: each unit applies its swap through the same batch, so
    // running now would read an empty anchor and undo the generation just
    // before its own translations land.
    batchDOMOperation(() => {
      if (isCurrent()) endVirtualTranslationOnlyGeneration(layoutSource)
    })
    return true
  } finally {
    nodes.forEach((node) => translatingNodes.delete(node))
  }
}

/**
 * Close a finished generation. Units that landed keep their own swap records
 * (on the container or, for a single-element unit, on that element), so the
 * anchor stays. When nothing landed at all — every unit filtered out, or every
 * translation equal to its source — the container is handed back exactly as it
 * was found, cuts rejoined and marker removed.
 */
function endVirtualTranslationOnlyGeneration(layoutSource: HTMLElement): void {
  const state = getTranslationOnlyAnchorState(layoutSource)
  if (!state) return

  const leftNoTrace =
    state.swaps.length === 0 &&
    layoutSource.querySelector(`[${TRANSLATION_ONLY_ATTRIBUTE}]`) === null &&
    // An error UI still on screen belongs to a unit that has not resolved for
    // the user yet; rejoining its cuts would pull the message out from under it.
    layoutSource.querySelector(`.${CONTENT_WRAPPER_CLASS}`) === null
  if (leftNoTrace) {
    // Nothing landed. A full restore clears the generation, rejoins whatever
    // was cut and hands the marker back, leaving the container as found.
    restoreTranslationOnlySwapsForAnchor(layoutSource)
    return
  }

  // Something landed, so the generation stays recorded. It is the only durable
  // sign that this container is segmented: a unit that is a whole element
  // registers its record on that element, and such a generation may not have
  // cut anything at all, so neither the container's own swaps nor its split
  // records can tell a later toggle what this is. Cleared by the full restore
  // that ends the generation.
}

/**
 * Translate one run of sibling nodes: protect attributes, send the run's HTML
 * as a single request, then swap the translation into the site's own text
 * nodes (falling back to a wrapper when the response cannot be aligned).
 *
 * `isCurrent` lets a caller that owns several runs invalidate the ones still
 * in flight — the virtual-paragraph path uses it so a unit whose generation
 * was torn down mid-request cannot write its response into restored text.
 */
async function translateTranslationOnlyRun(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceRetranslation: boolean = false,
  isCurrent: () => boolean = () => true,
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
  if (outerTransNodes.length === 1 && isHTMLElement(outerTransNodes[0]!)) {
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
        void translateTranslationOnlyRun(retryNodes, walkId, config, toggle, forceRetranslation)
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
    // Reuse the parent captured above: the restore-first pass may have taken
    // targetNode out of the document, and re-reading its parentElement would
    // throw on the null.
    const existedTranslatedWrapperOutside = parentNode.closest(`.${CONTENT_WRAPPER_CLASS}`)
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
        void translateTranslationOnlyRun(retryNodes, walkId, config, toggle, forceRetranslation)
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
      const translatedHtml = await translateTextForAction(
        protectedHtml.legacyRequestHtml,
        "html",
        forceRetranslation,
      )
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
        const translatedHtml = await translateTextForAction(
          protectedHtml.requestHtml,
          "html",
          forceRetranslation,
        )
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
      isCurrent,
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
        // A superseded run (its generation torn down) is stale for the same
        // reason even when its wrapper survived the round trip.
        if (!translatedWrapperNode.isConnected || !isCurrent()) return
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
      if (!translatedWrapperNode.isConnected || !isCurrent()) return

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
