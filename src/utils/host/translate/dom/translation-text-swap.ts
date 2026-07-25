import type { Config } from "@/types/config/config"
import type { TransNode } from "@/types/dom"
import { CONTENT_WRAPPER_CLASS, TRANSLATION_ONLY_ATTRIBUTE } from "../../../constants/dom-labels"
import { isHTMLElement, isTextNode } from "../../dom/filter"
import {
  dropTranslationOnlySwapRecords,
  markExtensionDrivenCharacterData,
  refreshTranslationOnlySwapRecordExpectedText,
  registerTranslationOnlyAnchorState,
  swapRecordIntersectsNodes,
  type TranslationOnlyAnchorState,
  type TranslationOnlySwapAttributeItem,
  type TranslationOnlySwapItem,
  type TranslationOnlySwapRecord,
} from "../core/translation-state"
import { setTranslationDirAndLang } from "../translation-attributes"
import {
  TRANSLATABLE_ATTRIBUTE_NAMES,
  TRANSLATABLE_INPUT_VALUE_TYPES,
} from "./translation-html-attributes"

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

// Element identity attributes: pairing is positional, so when a provider
// legitimately reorders same-tag siblings (links for target grammar), these
// must still match pairwise or the plan would cross-bind text onto the wrong
// element (wrong link text on the wrong href). Mismatch -> fallback strategy.
const IDENTITY_ATTRIBUTES = ["href", "src", "id"]

interface AlignmentAccumulator {
  pairs: TextSwapPair[]
  attributePairs: AttributeSwapPair[]
  coveredChars: number
  totalChars: number
  orphanTargetText: boolean
  // Last document-ordered text pair, used to carry provider-inserted
  // whitespace separators between adjacent inline elements.
  lastTextPair: TextSwapPair | null
}

function partitionLevel(nodes: readonly Node[]): {
  sequence: (Element | Text[])[]
} {
  // A level is a sequence of elements with text-node "gaps" between them.
  // Whitespace-only text nodes stay in the gaps: the provider may emit one as
  // the only word separator between adjacent inline elements.
  const sequence: (Element | Text[])[] = []
  let gap: Text[] = []
  for (const node of nodes) {
    if (isHTMLElement(node) && !isWrapperElement(node)) {
      sequence.push(gap)
      gap = []
      sequence.push(node)
    } else if (isTextNode(node)) {
      gap.push(node)
    }
    // comments / wrappers don't participate
  }
  sequence.push(gap)
  return { sequence }
}

function alignGap(sourceGap: Text[], targetGap: Text[], acc: AlignmentAccumulator): void {
  const relevantSource = sourceGap.filter((node) => node.data.trim())
  const gapChars = relevantSource.reduce((sum, node) => sum + node.data.length, 0)
  acc.totalChars += gapChars

  const joinedTarget = targetGap.map((node) => node.data).join("")

  if (relevantSource.length === 0) {
    if (joinedTarget.trim()) {
      // Translated text with no source slot would be dropped silently — bail.
      acc.orphanTargetText = true
    } else if (joinedTarget.length > 0 && acc.lastTextPair) {
      // Provider inserted a pure-whitespace separator where the source had
      // none (adjacent inline elements in CJK markup translated to a
      // Latin-script target). Carry it on the preceding text so words don't
      // jam together ("ApplesOranges").
      if (!/\s$/.test(acc.lastTextPair.translatedValue)) {
        acc.lastTextPair.translatedValue += " "
      }
    }
    return
  }
  if (!joinedTarget) return // uncovered source text

  const pair: TextSwapPair = { node: relevantSource[0], translatedValue: joinedTarget }
  acc.pairs.push(pair)
  // Provider merged several source fragments: the first node carries the whole
  // translation, the rest are blanked (same parent, so visually identical).
  for (const extra of relevantSource.slice(1)) {
    acc.pairs.push({ node: extra, translatedValue: "" })
  }
  acc.lastTextPair = pair
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
    for (const name of IDENTITY_ATTRIBUTES) {
      if (sourceElements[i].getAttribute(name) !== targetElements[i].getAttribute(name)) {
        return false
      }
    }
  }

  // Both sequences strictly alternate gap, el, gap, el, ..., gap and element
  // counts are equal, so positions line up. Walk them interleaved in document
  // order so lastTextPair (the whitespace-separator carrier) is correct.
  for (let i = 0; i < source.sequence.length; i++) {
    const sourceItem = source.sequence[i]
    const targetItem = target.sequence[i]
    if (Array.isArray(sourceItem)) {
      alignGap(sourceItem, Array.isArray(targetItem) ? targetItem : [], acc)
      continue
    }
    const targetElement = targetItem as Element
    collectTranslatedAttributePairs(sourceItem, targetElement, acc)
    if (!alignLevel([...sourceItem.childNodes], [...targetElement.childNodes], acc)) {
      return false
    }
  }
  return true
}

function collectTranslatedAttributePairs(
  source: Element,
  target: Element,
  acc: AlignmentAccumulator,
): void {
  // Same attribute set the protection layer exposes to providers for
  // translation — anything narrower silently drops translated values.
  for (const name of TRANSLATABLE_ATTRIBUTE_NAMES) {
    const translatedValue = target.getAttribute(name)
    if (translatedValue !== null && translatedValue !== source.getAttribute(name)) {
      acc.attributePairs.push({ element: source, name, translatedValue })
    }
  }
  if (
    source.localName === "input" &&
    TRANSLATABLE_INPUT_VALUE_TYPES.has((source.getAttribute("type") ?? "").toLowerCase())
  ) {
    const translatedValue = target.getAttribute("value")
    if (translatedValue !== null && translatedValue !== source.getAttribute("value")) {
      acc.attributePairs.push({ element: source, name: "value", translatedValue })
    }
  }
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
    lastTextPair: null,
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
 * register the guarded-restore state on the anchor. An existing record for
 * the same run (a retranslation pass) is replaced, not appended.
 */
export function applyInPlaceTextSwap(
  plan: TextSwapPlan,
  runNodes: readonly TransNode[],
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

  const record: TranslationOnlySwapRecord = {
    walkId,
    runNodes: [...runNodes],
    expectedRunText: "",
    items,
    attributeItems,
  }
  refreshTranslationOnlySwapRecordExpectedText(record)

  const existingState = getAnchorState(anchor)
  if (existingState) {
    // A retranslation pass replaces its run's previous record — appending
    // would leave a dead record whose stale references keep flagging the
    // anchor as host-changed.
    dropTranslationOnlySwapRecords(
      existingState,
      existingState.swaps.filter((existing) => swapRecordIntersectsNodes(existing, runNodes)),
    )
    existingState.swaps.push(record)
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
  registerTranslationOnlyAnchorState({
    anchor,
    attributeAdjustments,
    swaps: [record],
  })
}
