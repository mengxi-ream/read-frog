import type { Config } from "@/types/config/config"
import type { TransNode } from "@/types/dom"
import { CONTENT_WRAPPER_CLASS, TRANSLATION_ONLY_ATTRIBUTE } from "../../../constants/dom-labels"
import { isHTMLElement, isTextNode } from "../../dom/filter"
import {
  markExtensionDrivenCharacterData,
  refreshTranslationOnlyAnchorExpectedText,
  registerTranslationOnlyAnchorState,
  type TranslationOnlyAnchorState,
  type TranslationOnlySwapAttributeItem,
  type TranslationOnlySwapItem,
} from "../core/translation-state"
import { setTranslationDirAndLang } from "../translation-attributes"

// All-or-nothing for now: a partially swapped paragraph mixes languages, and
// the detach-with-node-refs fallback is acceptable. Named so it can be relaxed
// once fallback-frequency data exists.
const IN_PLACE_SWAP_COVERAGE_THRESHOLD = 1

export interface TextSwapPair {
  node: Text
  translatedValue: string
}

export interface AttributeSwapPair {
  element: Element
  name: string
  translatedValue: string
}

export interface TextSwapPlan {
  pairs: TextSwapPair[]
  attributePairs: AttributeSwapPair[]
  coverage: number
}

export interface SourceTextSnapshotEntry {
  node: Text
  parent: Node | null
  value: string
}

function isSwapRelevantText(node: Node): node is Text {
  return isTextNode(node) && !!node.data.trim()
}

function isWrapperElement(node: Node): boolean {
  return isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS)
}

function collectTextNodes(node: Node, into: Text[]): void {
  if (isSwapRelevantText(node)) {
    into.push(node)
    return
  }
  if (!isHTMLElement(node) || isWrapperElement(node)) return
  for (const child of node.childNodes) collectTextNodes(child, into)
}

/** Source text nodes of a run, in document order, excluding wrapper subtrees. */
export function collectSourceTextNodes(transNodes: readonly TransNode[]): Text[] {
  const result: Text[] = []
  for (const node of transNodes) collectTextNodes(node, result)
  return result
}

/**
 * Snapshot the run's text nodes before the provider request so the response
 * handler can detect host mutations that happened while the request was in
 * flight (never swap against content the host has since rewritten).
 */
export function snapshotSourceTextNodes(
  transNodes: readonly TransNode[],
): SourceTextSnapshotEntry[] {
  return collectSourceTextNodes(transNodes).map((node) => ({
    node,
    parent: node.parentNode,
    value: node.data,
  }))
}

/**
 * The snapshot still describes the live DOM exactly: same text-node objects in
 * the same order under the same parents with the same values, and no new text
 * appeared inside the run.
 */
export function verifySourceSnapshot(
  transNodes: readonly TransNode[],
  snapshot: readonly SourceTextSnapshotEntry[],
): boolean {
  const connectedTransNodes = transNodes.filter((node) => node.isConnected)
  if (connectedTransNodes.length !== transNodes.length) return false
  const current = collectSourceTextNodes(transNodes)
  if (current.length !== snapshot.length) return false
  return snapshot.every(
    (entry, index) =>
      current[index] === entry.node &&
      entry.node.parentNode === entry.parent &&
      entry.node.data === entry.value,
  )
}

// Human-visible attributes the provider may legitimately translate. The
// placeholder protection keeps structural attributes (href, class, …) intact,
// so only these need swapping onto the source element.
const TRANSLATABLE_ATTRIBUTES = ["title", "alt", "placeholder", "aria-label"]

interface AlignmentAccumulator {
  pairs: TextSwapPair[]
  attributePairs: AttributeSwapPair[]
  coveredChars: number
  totalChars: number
  orphanTargetText: boolean
}

function partitionLevel(nodes: readonly Node[]): {
  sequence: (Element | Text[])[]
} {
  // A level is a sequence of elements with text-node "gaps" between them.
  const sequence: (Element | Text[])[] = []
  let gap: Text[] = []
  for (const node of nodes) {
    if (isHTMLElement(node) && !isWrapperElement(node)) {
      sequence.push(gap)
      gap = []
      sequence.push(node)
    } else if (isSwapRelevantText(node)) {
      gap.push(node)
    }
    // comments / whitespace-only text / wrappers don't participate
  }
  sequence.push(gap)
  return { sequence }
}

function alignGap(sourceGap: Text[], targetGap: Text[], acc: AlignmentAccumulator): void {
  const gapChars = sourceGap.reduce((sum, node) => sum + node.data.length, 0)
  acc.totalChars += gapChars

  if (sourceGap.length === 0) {
    if (targetGap.some((node) => node.data.trim())) {
      // Translated text with no source slot would be dropped silently — bail.
      acc.orphanTargetText = true
    }
    return
  }
  if (targetGap.length === 0) return // uncovered source text

  const joinedTarget = targetGap.map((node) => node.data).join("")
  acc.pairs.push({ node: sourceGap[0], translatedValue: joinedTarget })
  // Provider merged several source fragments: the first node carries the whole
  // translation, the rest are blanked (same parent, so visually identical).
  for (const extra of sourceGap.slice(1)) {
    acc.pairs.push({ node: extra, translatedValue: "" })
  }
  acc.coveredChars += gapChars
}

function alignLevel(
  sourceNodes: readonly Node[],
  targetNodes: readonly Node[],
  acc: AlignmentAccumulator,
): boolean {
  const source = partitionLevel(sourceNodes)
  const target = partitionLevel(targetNodes)

  const sourceElements = source.sequence.filter((item): item is Element => !Array.isArray(item))
  const targetElements = target.sequence.filter((item): item is Element => !Array.isArray(item))
  if (sourceElements.length !== targetElements.length) return false
  for (let i = 0; i < sourceElements.length; i++) {
    if (sourceElements[i].localName !== targetElements[i].localName) return false
  }
  for (let i = 0; i < sourceElements.length; i++) {
    for (const name of TRANSLATABLE_ATTRIBUTES) {
      const translatedValue = targetElements[i].getAttribute(name)
      if (translatedValue !== null && translatedValue !== sourceElements[i].getAttribute(name)) {
        acc.attributePairs.push({ element: sourceElements[i], name, translatedValue })
      }
    }
  }

  // With equal element counts both sequences interleave identically:
  // gap, el, gap, el, ..., gap
  const sourceGaps = source.sequence.filter((item): item is Text[] => Array.isArray(item))
  const targetGaps = target.sequence.filter((item): item is Text[] => Array.isArray(item))
  for (let i = 0; i < sourceGaps.length; i++) {
    alignGap(sourceGaps[i], targetGaps[i] ?? [], acc)
  }
  for (let i = 0; i < sourceElements.length; i++) {
    if (!alignLevel([...sourceElements[i].childNodes], [...targetElements[i].childNodes], acc)) {
      return false
    }
  }
  return true
}

/**
 * Pair the run's live source text nodes against the provider's translated
 * HTML. Returns null when the structures cannot be aligned confidently — the
 * caller then falls back to the detach-with-node-refs strategy.
 */
export function planInPlaceTextSwap(
  transNodes: readonly TransNode[],
  translatedHtml: string,
  ownerDoc: Document,
): TextSwapPlan | null {
  const sourceTextNodes = collectSourceTextNodes(transNodes)
  if (sourceTextNodes.length === 0) return null

  const template = ownerDoc.createElement("template")
  template.innerHTML = translatedHtml
  const targetNodes = [...template.content.childNodes]

  // Dominant trivial case: a single source text node takes the whole
  // translation as plain text, which also neutralizes hallucinated tags.
  if (sourceTextNodes.length === 1 && transNodes.every((node) => isTextNode(node))) {
    const translatedText = template.content.textContent ?? ""
    if (!translatedText.trim()) return null
    return {
      pairs: [{ node: sourceTextNodes[0], translatedValue: translatedText }],
      attributePairs: [],
      coverage: 1,
    }
  }

  const acc: AlignmentAccumulator = {
    pairs: [],
    attributePairs: [],
    coveredChars: 0,
    totalChars: 0,
    orphanTargetText: false,
  }
  if (!alignLevel(transNodes, targetNodes, acc)) return null
  if (acc.orphanTargetText) return null
  if (acc.totalChars === 0) return null

  const coverage = acc.coveredChars / acc.totalChars
  if (coverage < IN_PLACE_SWAP_COVERAGE_THRESHOLD) return null
  return { pairs: acc.pairs, attributePairs: acc.attributePairs, coverage }
}

/**
 * Write the paired translated values into the site's own text nodes and
 * register the guarded-restore state on the anchor.
 */
export function applyInPlaceTextSwap(
  plan: TextSwapPlan,
  anchor: HTMLElement,
  walkId: string,
  config: Config,
  getAnchorState: (anchor: HTMLElement) => TranslationOnlyAnchorState | undefined,
): void {
  const items: TranslationOnlySwapItem[] = []
  for (const { node, translatedValue } of plan.pairs) {
    items.push({ node, originalValue: node.data, translatedValue })
    markExtensionDrivenCharacterData(node, translatedValue)
    node.data = translatedValue
  }

  const attributeItems: TranslationOnlySwapAttributeItem[] = []
  for (const { element, name, translatedValue } of plan.attributePairs) {
    attributeItems.push({
      element,
      name,
      originalValue: element.getAttribute(name),
      translatedValue,
    })
    element.setAttribute(name, translatedValue)
  }

  const existingState = getAnchorState(anchor)
  if (existingState) {
    existingState.swaps.push({ walkId, items, attributeItems })
    refreshTranslationOnlyAnchorExpectedText(existingState)
    return
  }

  const attributeAdjustments = [
    {
      name: TRANSLATION_ONLY_ATTRIBUTE,
      previousValue: anchor.getAttribute(TRANSLATION_ONLY_ATTRIBUTE),
    },
    { name: "dir", previousValue: anchor.getAttribute("dir") },
    { name: "lang", previousValue: anchor.getAttribute("lang") },
  ]
  anchor.setAttribute(TRANSLATION_ONLY_ATTRIBUTE, "")
  setTranslationDirAndLang(anchor, config)
  const state: TranslationOnlyAnchorState = {
    anchor,
    attributeAdjustments,
    swaps: [{ walkId, items, attributeItems }],
    expectedTextContent: "",
  }
  registerTranslationOnlyAnchorState(state)
  // After registration so nested-anchor exclusion sees a consistent registry
  refreshTranslationOnlyAnchorExpectedText(state)
}
