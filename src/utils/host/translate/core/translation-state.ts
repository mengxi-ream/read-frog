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
// WeakMap so elements removed by the site (SPA re-renders, infinite scroll)
// don't pin themselves and their innerHTML snapshots for the page's lifetime.
export const originalContentMap = new WeakMap<Element, string>()

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
