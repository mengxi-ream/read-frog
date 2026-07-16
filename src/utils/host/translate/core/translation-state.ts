import { MARK_ATTRIBUTES } from "../../../constants/dom-labels"
import { isTranslatedWrapperNode } from "../../dom/filter"

export interface TextSplitRecord {
  source: Text
  parent: Node
  originalValue: string
  createdTails: Text[]
  sourceValueAfterSplit: string
  tailValuesAfterSplit: string[]
}

export interface VirtualParagraphSourceSnapshot {
  source: Text | HTMLElement
  parent: Node | null
  value: string
}

interface VirtualParagraphWrapperPlacement {
  parent: Node
  previousSibling: ChildNode | null
  nextSibling: ChildNode | null
}

export interface VirtualParagraphGroup {
  id: string
  walkId: string
  status: "active" | "disposing" | "disposed"
  layoutSource: HTMLElement
  wrappers: Set<HTMLElement>
  splitRecords: TextSplitRecord[]
  sourceSnapshots: VirtualParagraphSourceSnapshot[]
  sourceTextContent: string
  wrapperPlacements: Map<HTMLElement, VirtualParagraphWrapperPlacement>
}

export interface BilingualTranslationState {
  layoutSource: HTMLElement
  sourceTextContent: string
  status: "active" | "disposed"
  walkId: string
  wrapper: HTMLElement | null
}

// State management for translation operations
export const translatingNodes = new WeakSet<ChildNode>()
// Original ChildNode objects a translationOnly wrapper displaced, keyed by that
// wrapper. Restore re-inserts these SAME node objects at the wrapper's position
// (node-identity restore) — never an ancestor innerHTML rewrite, which destroys
// framework-owned node identity and untouched sibling content (#1846).
// WeakMap so a wrapper deleted by the site (SPA re-renders) releases its
// retained originals instead of pinning them for the page's lifetime.
const translationOnlyOriginalNodes = new WeakMap<HTMLElement, ChildNode[]>()

export function registerTranslationOnlyOriginals(wrapper: HTMLElement, nodes: ChildNode[]): void {
  translationOnlyOriginalNodes.set(wrapper, nodes)
}

export function takeTranslationOnlyOriginals(wrapper: HTMLElement): ChildNode[] | undefined {
  const nodes = translationOnlyOriginalNodes.get(wrapper)
  if (nodes) translationOnlyOriginalNodes.delete(wrapper)
  return nodes
}

// ---- In-place text swap state (translationOnly preferred strategy) ----
// A successful swap leaves NO wrapper in the DOM: the site's own text nodes
// hold the translated values. The anchor element (the swapped run's parent)
// carries TRANSLATION_ONLY_ATTRIBUTE as the queryable handle and this WeakMap
// holds the restore payload.

export interface TranslationOnlySwapItem {
  node: Text
  originalValue: string
  translatedValue: string
}

// Human-visible attributes the provider translated (title, alt, …) — swapped
// on the source element alongside its text, restored with the same guard.
export interface TranslationOnlySwapAttributeItem {
  element: Element
  name: string
  originalValue: string | null
  translatedValue: string
}

export interface TranslationOnlySwapRecord {
  walkId: string
  // The run's top-level nodes at swap time. Staleness is judged per record
  // against exactly these nodes — NEVER against an anchor-wide text aggregate,
  // which would couple the record to unrelated nested content (a descendant
  // anchor registering/unregistering, a sibling run's fallback displacement)
  // and produce permanent false staleness (adversarial-review finding).
  runNodes: ChildNode[]
  // Aggregate run text right after our swap wrote it; host deviation means
  // this run needs retranslation (expand/"show more" re-renders).
  expectedRunText: string
  items: TranslationOnlySwapItem[]
  attributeItems: TranslationOnlySwapAttributeItem[]
}

export interface TranslationOnlyAnchorState {
  anchor: HTMLElement
  // Attribute values before we touched the anchor (dir/lang/marker), restored
  // guardedly when the last swap is undone.
  attributeAdjustments: { name: string; previousValue: string | null }[]
  swaps: TranslationOnlySwapRecord[]
}

const translationOnlyAnchorStates = new WeakMap<HTMLElement, TranslationOnlyAnchorState>()

function collectRunText(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const data = (node as Text).data
    if (data.trim()) parts.push(data)
    return
  }
  if (!(node instanceof HTMLElement)) return
  if (isTranslatedWrapperNode(node)) return
  for (const child of node.childNodes) collectRunText(child, parts)
}

/** Aggregate comparable text of a swap record's run, in document order. */
export function collectTranslationOnlyRunText(runNodes: readonly ChildNode[]): string {
  const parts: string[] = []
  for (const node of runNodes) collectRunText(node, parts)
  return parts.join("")
}

export function refreshTranslationOnlySwapRecordExpectedText(
  record: TranslationOnlySwapRecord,
): void {
  record.expectedRunText = collectTranslationOnlyRunText(
    record.runNodes.filter((node) => node.isConnected),
  )
}

export function isTranslationOnlySwapRecordCurrent(record: TranslationOnlySwapRecord): boolean {
  if (record.runNodes.some((node) => !node.isConnected)) return false
  return collectTranslationOnlyRunText(record.runNodes) === record.expectedRunText
}

/**
 * Nearest ancestor anchor one of whose swapped runs the host changed — the
 * translationOnly counterpart of findStaleBilingualLayoutSource. Feeds the
 * same budgeted retranslation pipeline so expand/"show more" re-renders get
 * translated instead of staying in the source language.
 */
export function findStaleTranslationOnlyAnchor(node: Node): HTMLElement | undefined {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (current) {
    const state = translationOnlyAnchorStates.get(current)
    if (
      state?.anchor.isConnected &&
      state.swaps.some((record) => !isTranslationOnlySwapRecordCurrent(record))
    ) {
      return current
    }
    current = current.parentElement
  }
  return undefined
}

/** A record every one of whose nodes the host disconnected: nothing restorable. */
export function isTranslationOnlySwapRecordDead(record: TranslationOnlySwapRecord): boolean {
  return (
    record.runNodes.every((node) => !node.isConnected) &&
    record.items.every((item) => !item.node.isConnected)
  )
}

export function swapRecordIntersectsNodes(
  record: TranslationOnlySwapRecord,
  nodes: readonly ChildNode[],
): boolean {
  const touches = (candidate: ChildNode) =>
    nodes.some(
      (node) =>
        node === candidate ||
        (node instanceof HTMLElement && node.contains(candidate)) ||
        (candidate instanceof HTMLElement && candidate.contains(node)),
    )
  return record.runNodes.some(touches) || record.items.some((item) => touches(item.node))
}

export function dropTranslationOnlySwapRecords(
  state: TranslationOnlyAnchorState,
  records: readonly TranslationOnlySwapRecord[],
): void {
  if (records.length === 0) return
  state.swaps = state.swaps.filter((record) => !records.includes(record))
}

export function getTranslationOnlyAnchorState(
  anchor: HTMLElement,
): TranslationOnlyAnchorState | undefined {
  return translationOnlyAnchorStates.get(anchor)
}

export function registerTranslationOnlyAnchorState(state: TranslationOnlyAnchorState): void {
  translationOnlyAnchorStates.set(state.anchor, state)
}

export function unregisterTranslationOnlyAnchorState(anchor: HTMLElement): void {
  translationOnlyAnchorStates.delete(anchor)
}

// Extension-written text-node values, so the mutation observer can classify
// characterData records from in-place swaps/restores as self-inflicted. Value
// comparison rather than membership: a later SITE write to the same node must
// still count as a host mutation.
const extensionDrivenCharacterData = new WeakMap<Node, string>()

export function markExtensionDrivenCharacterData(node: Node, writtenValue: string): void {
  extensionDrivenCharacterData.set(node, writtenValue)
}

export function wasCharacterDataChangeExtensionDriven(node: Node): boolean {
  const written = extensionDrivenCharacterData.get(node)
  return written !== undefined && written === (node as CharacterData).data
}

const virtualParagraphGroupsBySource = new WeakMap<HTMLElement, VirtualParagraphGroup>()
const virtualParagraphGroupsByWrapper = new WeakMap<HTMLElement, VirtualParagraphGroup>()
const bilingualTranslationsBySource = new WeakMap<HTMLElement, BilingualTranslationState>()
const bilingualTranslationsByWrapper = new WeakMap<HTMLElement, BilingualTranslationState>()
// Filtering can await storage before wrappers are inserted. Keep only that
// short-lived pre-insertion window enumerable so a global stop can cancel it.
const pendingVirtualParagraphGroups = new Set<VirtualParagraphGroup>()
const pendingBilingualTranslations = new Set<BilingualTranslationState>()

export function registerVirtualParagraphGroup(group: VirtualParagraphGroup): void {
  virtualParagraphGroupsBySource.set(group.layoutSource, group)
  pendingVirtualParagraphGroups.add(group)
  group.wrappers.forEach((wrapper) => virtualParagraphGroupsByWrapper.set(wrapper, group))
}

export function markVirtualParagraphGroupInserted(group: VirtualParagraphGroup): void {
  pendingVirtualParagraphGroups.delete(group)
  group.wrapperPlacements.clear()
  for (const wrapper of group.wrappers) {
    if (!wrapper.parentNode) continue
    group.wrapperPlacements.set(wrapper, {
      parent: wrapper.parentNode,
      previousSibling: wrapper.previousSibling,
      nextSibling: wrapper.nextSibling,
    })
  }
}

export function getPendingVirtualParagraphGroups(): VirtualParagraphGroup[] {
  return [...pendingVirtualParagraphGroups]
}

function collectHostText(
  layoutSource: HTMLElement,
  excludedWrappers: ReadonlySet<HTMLElement>,
): string {
  let text = ""
  const collect = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += (child as Text).data
      } else if (
        // Skip ALL extension translation wrappers, not only this state's own:
        // a descendant state's wrapper inside an ancestor source otherwise counts
        // as a host-text change and keeps the ancestor permanently stale (#1831).
        !excludedWrappers.has(child as HTMLElement) &&
        !isTranslatedWrapperNode(child)
      ) {
        collect(child)
      }
    }
  }
  collect(layoutSource)
  return text
}

const EMPTY_WRAPPER_SET: ReadonlySet<HTMLElement> = new Set()

// Removals we initiate must not be mistaken for host-page mutations by the
// page MutationObserver, while genuine site-driven removals of our wrappers
// must keep triggering retranslation (#1831). Membership is checked, never
// consumed — duplicate observers may deliver the same removal record.
const extensionDrivenRemovals = new WeakSet<Node>()

export function markExtensionDrivenNodeRemoval(node: Node): void {
  extensionDrivenRemovals.add(node)
}

export function wasNodeRemovedByExtension(node: Node): boolean {
  return extensionDrivenRemovals.has(node)
}

/**
 * Source-text snapshot that matches what collectHostText will see later.
 * Raw `layoutSource.textContent` would include descendant wrapper text and
 * make the staleness comparison asymmetric.
 */
export function collectSourceTextExcludingWrappers(layoutSource: HTMLElement): string {
  return collectHostText(layoutSource, EMPTY_WRAPPER_SET)
}

export function registerBilingualTranslationState(state: BilingualTranslationState): void {
  bilingualTranslationsBySource.set(state.layoutSource, state)
  if (state.wrapper) bilingualTranslationsByWrapper.set(state.wrapper, state)
  else pendingBilingualTranslations.add(state)
}

export function attachBilingualTranslationWrapper(
  state: BilingualTranslationState,
  wrapper: HTMLElement,
): void {
  if (
    state.status !== "active" ||
    bilingualTranslationsBySource.get(state.layoutSource) !== state
  ) {
    return
  }
  pendingBilingualTranslations.delete(state)
  state.wrapper = wrapper
  bilingualTranslationsByWrapper.set(wrapper, state)
}

export function getPendingBilingualTranslationStates(): BilingualTranslationState[] {
  return [...pendingBilingualTranslations]
}

export function getBilingualTranslationStateForSource(
  source: HTMLElement,
): BilingualTranslationState | undefined {
  return bilingualTranslationsBySource.get(source)
}

export function getBilingualTranslationStateForWrapper(
  wrapper: HTMLElement,
): BilingualTranslationState | undefined {
  return bilingualTranslationsByWrapper.get(wrapper)
}

export function unregisterBilingualTranslationState(state: BilingualTranslationState): void {
  pendingBilingualTranslations.delete(state)
  if (bilingualTranslationsBySource.get(state.layoutSource) === state) {
    bilingualTranslationsBySource.delete(state.layoutSource)
  }
  if (state.wrapper && bilingualTranslationsByWrapper.get(state.wrapper) === state) {
    bilingualTranslationsByWrapper.delete(state.wrapper)
  }
  state.status = "disposed"
}

export function isBilingualTranslationStateCurrent(state: BilingualTranslationState): boolean {
  if (
    state.status !== "active" ||
    bilingualTranslationsBySource.get(state.layoutSource) !== state ||
    !state.layoutSource.isConnected
  ) {
    return false
  }

  if (state.wrapper === null) {
    return (
      pendingBilingualTranslations.has(state) &&
      collectHostText(state.layoutSource, new Set()) === state.sourceTextContent
    )
  }

  return (
    bilingualTranslationsByWrapper.get(state.wrapper) === state &&
    state.wrapper.isConnected &&
    state.layoutSource.contains(state.wrapper) &&
    collectHostText(state.layoutSource, new Set([state.wrapper])) === state.sourceTextContent
  )
}

export function findStaleBilingualLayoutSource(node: Node): HTMLElement | undefined {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (current) {
    const virtualGroup = virtualParagraphGroupsBySource.get(current)
    if (virtualGroup && !isVirtualParagraphGroupCurrent(virtualGroup)) return current

    const bilingualState = bilingualTranslationsBySource.get(current)
    if (bilingualState && !isBilingualTranslationStateCurrent(bilingualState)) return current
    current = current.parentElement
  }
  return undefined
}

export function registerVirtualParagraphWrapper(
  group: VirtualParagraphGroup,
  wrapper: HTMLElement,
): void {
  if (
    group.status !== "active" ||
    virtualParagraphGroupsBySource.get(group.layoutSource) !== group
  ) {
    return
  }
  group.wrappers.add(wrapper)
  virtualParagraphGroupsByWrapper.set(wrapper, group)
}

export function getVirtualParagraphGroupForSource(
  source: HTMLElement,
): VirtualParagraphGroup | undefined {
  return virtualParagraphGroupsBySource.get(source)
}

export function getVirtualParagraphGroupForWrapper(
  wrapper: HTMLElement,
): VirtualParagraphGroup | undefined {
  return virtualParagraphGroupsByWrapper.get(wrapper)
}

export function isVirtualParagraphGroupCurrent(
  group: VirtualParagraphGroup,
  wrapper?: HTMLElement,
): boolean {
  if (
    group.status !== "active" ||
    virtualParagraphGroupsBySource.get(group.layoutSource) !== group ||
    !group.layoutSource.isConnected
  ) {
    return false
  }

  if (collectHostText(group.layoutSource, group.wrappers) !== group.sourceTextContent) return false

  const splitRecordsBySource = new Map(
    group.splitRecords.map((record) => [record.source, record] as const),
  )
  for (const { source, parent, originalValue, createdTails } of group.splitRecords) {
    const fragments = [source, ...createdTails]
    let previousIndex = -1
    for (const fragment of fragments) {
      if (!fragment.isConnected || fragment.parentNode !== parent) return false
      const index = [...parent.childNodes].indexOf(fragment)
      if (index <= previousIndex) return false
      previousIndex = index
    }
    if (fragments.map((fragment) => fragment.data).join("") !== originalValue) return false
  }

  for (const { source, parent, value } of group.sourceSnapshots) {
    if (source.parentNode !== parent || !source.isConnected) return false

    if (source.nodeType === Node.TEXT_NODE) {
      const splitRecord = splitRecordsBySource.get(source as Text)
      if (splitRecord) {
        if (splitRecord.originalValue !== value) return false
      } else if ((source as Text).data !== value) {
        return false
      }
    } else if (source.textContent !== value) {
      return false
    }
  }

  for (let index = 1; index < group.sourceSnapshots.length; index += 1) {
    const previous = group.sourceSnapshots[index - 1].source
    const current = group.sourceSnapshots[index].source
    if (!(previous.compareDocumentPosition(current) & 4)) return false
  }

  const isOwnedWrapper = (candidate: HTMLElement) => {
    const placement = group.wrapperPlacements.get(candidate)
    return (
      group.wrappers.has(candidate) &&
      virtualParagraphGroupsByWrapper.get(candidate) === group &&
      candidate.isConnected &&
      group.layoutSource.contains(candidate) &&
      placement !== undefined &&
      candidate.parentNode === placement.parent &&
      candidate.previousSibling === placement.previousSibling &&
      candidate.nextSibling === placement.nextSibling
    )
  }

  if (wrapper !== undefined) return isOwnedWrapper(wrapper)
  if (pendingVirtualParagraphGroups.has(group)) return true
  return group.wrappers.size > 0 && [...group.wrappers].every(isOwnedWrapper)
}

export function unregisterVirtualParagraphWrapper(
  group: VirtualParagraphGroup,
  wrapper: HTMLElement,
): void {
  if (virtualParagraphGroupsByWrapper.get(wrapper) === group) {
    virtualParagraphGroupsByWrapper.delete(wrapper)
  }
  group.wrappers.delete(wrapper)
  group.wrapperPlacements.delete(wrapper)
}

export function unregisterVirtualParagraphGroup(group: VirtualParagraphGroup): void {
  pendingVirtualParagraphGroups.delete(group)
  if (virtualParagraphGroupsBySource.get(group.layoutSource) === group) {
    virtualParagraphGroupsBySource.delete(group.layoutSource)
  }
  group.wrappers.forEach((wrapper) => {
    if (virtualParagraphGroupsByWrapper.get(wrapper) === group) {
      virtualParagraphGroupsByWrapper.delete(wrapper)
    }
  })
}

// Pre-compiled regex for better performance - removes all mark attributes
export const MARK_ATTRIBUTES_REGEX = new RegExp(
  `\\s*(?:${[...MARK_ATTRIBUTES].join("|")})(?:=['""][^'"]*['""]|=[^\\s>]*)?`,
  "g",
)
