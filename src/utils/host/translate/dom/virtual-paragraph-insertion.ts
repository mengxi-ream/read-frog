import type { TextSplitRecord } from "../core/translation-state"
import type { VirtualParagraphPlan, VirtualParagraphUnit } from "./paragraph-segmentation"
import type { Config } from "@/types/config/config"
import { isTextNode } from "../../dom/filter"
import { markExtensionDrivenCharacterData } from "../core/translation-state"
import { resolveVirtualParagraphUnitEdges } from "./paragraph-segmentation"

export interface VirtualParagraphWrapperEntry {
  unit: VirtualParagraphUnit
  wrapper: HTMLElement
}

function insertWrapperAtBoundary(
  { container, offset }: VirtualParagraphUnit["insertionBoundary"],
  wrapper: HTMLElement,
  splitRecords: Map<Text, TextSplitRecord>,
  splitRecordTarget: TextSplitRecord[],
): void {
  if (isTextNode(container)) {
    const parent = container.parentNode
    if (!parent || offset < 0 || offset > container.data.length) {
      throw new Error("Virtual paragraph Text boundary is no longer valid")
    }

    if (offset === 0) {
      parent.insertBefore(wrapper, container)
      return
    }

    if (offset === container.data.length) {
      parent.insertBefore(wrapper, container.nextSibling)
      return
    }

    let splitRecord = splitRecords.get(container)
    if (!splitRecord) {
      splitRecord = {
        source: container,
        parent,
        originalValue: container.data,
        createdTails: [],
        sourceValueAfterSplit: container.data,
        tailValuesAfterSplit: [],
      }
      splitRecords.set(container, splitRecord)
      splitRecordTarget.push(splitRecord)
    }

    const tail = container.splitText(offset)
    // Boundaries are applied in reverse document order. Prepending each new
    // tail leaves the record in final DOM order for exact cleanup.
    splitRecord.createdTails.unshift(tail)
    parent.insertBefore(wrapper, tail)
    return
  }

  if (offset < 0 || offset > container.childNodes.length) {
    throw new Error("Virtual paragraph element boundary is no longer valid")
  }
  container.insertBefore(wrapper, container.childNodes[offset] ?? null)
}

/**
 * Insert every wrapper synchronously from the end of the source towards the
 * beginning. This keeps all precomputed Text offsets stable even when several
 * paragraph boundaries live in the same Text node.
 */
export function insertVirtualParagraphWrappers(
  entries: VirtualParagraphWrapperEntry[],
  splitRecordTarget: TextSplitRecord[] = [],
): { inserted: VirtualParagraphWrapperEntry[]; splitRecords: TextSplitRecord[] } {
  const splitRecords = new Map(splitRecordTarget.map((record) => [record.source, record] as const))

  for (const entry of [...entries].reverse()) {
    insertWrapperAtBoundary(
      entry.unit.insertionBoundary,
      entry.wrapper,
      splitRecords,
      splitRecordTarget,
    )
  }

  for (const record of splitRecordTarget) {
    record.sourceValueAfterSplit = record.source.data
    record.tailValuesAfterSplit = record.createdTails.map((tail) => tail.data)
  }

  return { inserted: entries, splitRecords: splitRecordTarget }
}

/** One virtual paragraph realized as whole children of the layout source. */
export interface VirtualParagraphUnitRun {
  unit: VirtualParagraphUnit
  /** Contiguous children of the layout source holding exactly this unit's text. */
  nodes: ChildNode[]
}

function splitTopLevelText(
  node: Text,
  offset: number,
  splitRecords: Map<Text, TextSplitRecord>,
  splitRecordTarget: TextSplitRecord[],
): Text {
  const parent = node.parentNode
  if (!parent) {
    throw new Error("Virtual paragraph unit source is detached")
  }

  let splitRecord = splitRecords.get(node)
  if (!splitRecord) {
    splitRecord = {
      source: node,
      parent,
      originalValue: node.data,
      createdTails: [],
      sourceValueAfterSplit: node.data,
      tailValuesAfterSplit: [],
    }
    splitRecords.set(node, splitRecord)
    splitRecordTarget.push(splitRecord)
  }

  const tail = node.splitText(offset)
  // Cuts are applied in reverse document order, so prepending each new tail
  // leaves the record in final DOM order for exact cleanup.
  splitRecord.createdTails.unshift(tail)
  return tail
}

/**
 * Turn each virtual paragraph into its own run of whole child nodes, so
 * translationOnly can hand one unit at a time to the ordinary per-run pipeline
 * (attribute protection, alignment, in-place swap, restore records) instead of
 * swapping the entire container as one blob.
 *
 * Only top-level Text nodes are cut, and only where a unit's text starts or
 * ends inside one; the blank lines between units stay in their own nodes,
 * untouched. Returns `null` when the plan cannot be expressed this way — see
 * `resolveVirtualParagraphUnitEdges` — leaving the caller on its existing path.
 *
 * Cuts run from the end of the container towards the beginning, and within a
 * unit the end edge is cut before the start edge, so every offset computed
 * against the pre-split DOM is still valid when its turn comes: `splitText`
 * keeps all earlier content in the original node.
 */
export function materializeVirtualParagraphUnitRuns(
  layoutSource: HTMLElement,
  plan: VirtualParagraphPlan,
  config: Config,
  splitRecordTarget: TextSplitRecord[] = [],
): VirtualParagraphUnitRun[] | null {
  const edges = resolveVirtualParagraphUnitEdges(layoutSource, plan, config)
  if (!edges) return null

  const splitRecords = new Map(splitRecordTarget.map((record) => [record.source, record] as const))
  const bounds: Array<{ unit: VirtualParagraphUnit; first: ChildNode; last: ChildNode }> = []

  for (const edge of [...edges].reverse()) {
    let last = edge.endNode
    if (edge.endOffset !== null && isTextNode(edge.endNode)) {
      // Cut the delimiter loose; the head now ends where the unit's text does.
      splitTopLevelText(edge.endNode, edge.endOffset, splitRecords, splitRecordTarget)
    }

    let first = edge.startNode
    if (edge.startOffset !== null && isTextNode(edge.startNode)) {
      first = splitTopLevelText(edge.startNode, edge.startOffset, splitRecords, splitRecordTarget)
      // Both edges in one node: the tail just cut is the whole unit.
      if (edge.startNode === edge.endNode) {
        last = first
      }
    }

    bounds.unshift({ unit: edge.unit, first, last })
  }

  for (const record of splitRecordTarget) {
    record.sourceValueAfterSplit = record.source.data
    record.tailValuesAfterSplit = record.createdTails.map((tail) => tail.data)
    // A cut shortens the source in place. Attribute that character-data change
    // to the extension so the mutation pipeline does not read our own split as
    // a host edit and flag the run stale.
    markExtensionDrivenCharacterData(record.source, record.source.data)
  }

  const runs: VirtualParagraphUnitRun[] = []
  for (const { unit, first, last } of bounds) {
    const nodes: ChildNode[] = []
    let current: ChildNode | null = first
    while (current) {
      nodes.push(current)
      if (current === last) break
      current = current.nextSibling
    }
    if (nodes.at(-1) !== last) return null
    runs.push({ unit, nodes })
  }

  return runs
}
