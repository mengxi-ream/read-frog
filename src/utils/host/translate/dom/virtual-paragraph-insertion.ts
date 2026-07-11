import type { TextSplitRecord } from "../core/translation-state"
import type { VirtualParagraphUnit } from "./paragraph-segmentation"
import type { TransNode } from "@/types/dom"
import { isTextNode, isTransNode } from "../../dom/filter"

export interface VirtualParagraphWrapperEntry {
  unit: VirtualParagraphUnit
  wrapper: HTMLElement
}

export interface InsertedVirtualParagraph extends VirtualParagraphWrapperEntry {
  flowSource: TransNode
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
  layoutSource: HTMLElement,
  splitRecordTarget: TextSplitRecord[] = [],
): { inserted: InsertedVirtualParagraph[]; splitRecords: TextSplitRecord[] } {
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

  const inserted = entries.map((entry): InsertedVirtualParagraph => {
    const previousSibling = entry.wrapper.previousSibling
    return {
      ...entry,
      flowSource: previousSibling && isTransNode(previousSibling) ? previousSibling : layoutSource,
    }
  })

  return { inserted, splitRecords: splitRecordTarget }
}
