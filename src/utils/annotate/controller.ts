import type { AnnotationRecord } from "./types"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { AnnotationLayer } from "./layer"
import {
  applyLeadingRung,
  clearLeadingRung,
  findLineHeightOwner,
  isLeadingUnsafe,
  leadingRungFor,
  measureLeading,
} from "./leading"
import { AnnotationMarks, supportsHighlightTextDecoration } from "./marks"
import { AnnotationRegistry } from "./registry"
import { ensureAnnotationDocumentStyles, removeAnnotationDocumentStyles } from "./styles"
import {
  findAnnotationBlock,
  findNearestOccurrence,
  getBlockText,
  isInsideTranslatedContent,
  offsetsToRange,
  rangeToOffsets,
} from "./text-offsets"

export type AnnotateFailure = "noBlock" | "multiBlock" | "translated" | "empty"

export type AnnotateResult =
  | { ok: true; record: AnnotationRecord; replaced: string[] }
  | { ok: false; reason: AnnotateFailure }

export interface AnnotationControllerOptions {
  removeLabel: string
}

interface BlockState {
  /** Whether the block's lines could be, or already were, given room for glosses. */
  glossFits: boolean
  /** The element carrying the line-height rung, when one was needed. */
  leadingOwner: Element | null
}

/**
 * Owns the annotations on one page: the registry (what is annotated), the
 * marks (the underlines, a CSS highlight) and the layer (the glosses), and
 * keeps the three in step as the page changes under them.
 */
export class AnnotationController {
  readonly registry = new AnnotationRegistry()
  private readonly marks = new AnnotationMarks()
  private readonly layer: AnnotationLayer
  private readonly ranges = new Map<string, Range>()
  private readonly blocks = new Map<Element, BlockState>()
  private readonly dirtyBlocks = new Set<Element>()
  private resolveQueued = false
  private readonly mutations = new MutationObserver((records) => this.onMutations(records))
  private readonly resizes =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => this.layer.scheduleRelayout())

  constructor(options: AnnotationControllerOptions) {
    this.layer = new AnnotationLayer({
      underlineInLayer: !this.marks.available || !supportsHighlightTextDecoration(),
      removeLabel: options.removeLabel,
      onRemove: (id) => this.remove(id),
    })
  }

  /**
   * Annotates the text of `range`. The text must lie in one block, in the
   * page's own prose. Annotations it overlaps, it replaces. The record starts
   * without its gloss.
   */
  annotate(range: Range): AnnotateResult {
    if (
      isInsideTranslatedContent(range.startContainer) ||
      isInsideTranslatedContent(range.endContainer)
    ) {
      return { ok: false, reason: "translated" }
    }
    const block = findAnnotationBlock(range.startContainer)
    const endBlock = findAnnotationBlock(range.endContainer)
    if (!block || !endBlock) return { ok: false, reason: "noBlock" }
    if (block !== endBlock) return { ok: false, reason: "multiBlock" }

    const offsets = rangeToOffsets(block, range)
    if (!offsets) return { ok: false, reason: "noBlock" }
    const surface = getBlockText(block).slice(offsets.start, offsets.end)
    if (surface.trim() === "") return { ok: false, reason: "empty" }

    const replaced = this.registry
      .overlapping(block, offsets.start, offsets.end)
      .map((record) => record.id)
    for (const id of replaced) this.remove(id)

    ensureAnnotationDocumentStyles()
    const probe = range.startContainer instanceof Text ? range.startContainer : null
    const state = this.ensureBlock(block, probe)

    const record: AnnotationRecord = {
      id: getRandomUUID(),
      block,
      start: offsets.start,
      end: offsets.end,
      surface,
      sourceId: "manual",
      status: "loading",
      gloss: null,
      glossFits: state.glossFits,
      createdAt: Date.now(),
    }
    const liveRange = offsetsToRange(block, offsets.start, offsets.end)
    if (!liveRange) return { ok: false, reason: "noBlock" }

    this.registry.add(record)
    this.ranges.set(record.id, liveRange)
    this.marks.add(liveRange)
    this.layer.set(record, liveRange)
    return { ok: true, record, replaced }
  }

  setGloss(id: string, gloss: string) {
    const record = this.registry.update(id, { status: "ready", gloss })
    if (record) this.layer.set(record)
  }

  remove(id: string) {
    const record = this.registry.remove(id)
    if (!record) return
    const range = this.ranges.get(id)
    if (range) this.marks.remove(range)
    this.ranges.delete(id)
    this.layer.delete(id)
    if (this.registry.recordsIn(record.block).length === 0) this.releaseBlock(record.block)
  }

  clear() {
    for (const record of this.registry.all()) this.remove(record.id)
  }

  dispose() {
    this.mutations.disconnect()
    this.resizes?.disconnect()
    for (const block of this.blocks.keys()) this.clearLeading(block)
    this.blocks.clear()
    this.ranges.clear()
    this.registry.clear()
    this.marks.dispose()
    this.layer.dispose()
    removeAnnotationDocumentStyles()
  }

  // Room between the lines is made once per block, before its first
  // annotation, and given back after its last.
  private ensureBlock(block: Element, probe: Text | null): BlockState {
    let state = this.blocks.get(block)
    if (state) return state
    state = { glossFits: !isLeadingUnsafe(block), leadingOwner: null }
    if (state.glossFits) {
      const measurement = measureLeading(block, probe)
      if (!measurement) {
        state.glossFits = false
      } else {
        const rung = leadingRungFor(measurement)
        if (rung !== null) {
          const owner = findLineHeightOwner(block, probe)
          applyLeadingRung(owner, rung)
          state.leadingOwner = owner
        }
      }
    }
    this.blocks.set(block, state)
    this.mutations.observe(block, { childList: true, characterData: true, subtree: true })
    this.resizes?.observe(block)
    return state
  }

  private releaseBlock(block: Element) {
    this.clearLeading(block)
    this.blocks.delete(block)
    this.resizes?.unobserve(block)
    // A MutationObserver has no unobserve: start over with the blocks left.
    this.mutations.disconnect()
    for (const observed of this.blocks.keys()) {
      this.mutations.observe(observed, { childList: true, characterData: true, subtree: true })
    }
  }

  private clearLeading(block: Element) {
    const owner = this.blocks.get(block)?.leadingOwner
    if (owner) clearLeadingRung(owner)
  }

  private onMutations(records: MutationRecord[]) {
    for (const mutation of records) {
      let node: Node | null = mutation.target
      while (node && !(node instanceof Element && this.blocks.has(node))) node = node.parentNode
      if (node instanceof Element) this.dirtyBlocks.add(node)
    }
    if (this.resolveQueued || this.dirtyBlocks.size === 0) return
    this.resolveQueued = true
    queueMicrotask(() => {
      this.resolveQueued = false
      const blocks = [...this.dirtyBlocks]
      this.dirtyBlocks.clear()
      for (const block of blocks) this.resolveBlock(block)
    })
  }

  /**
   * Rebuilds a block's ranges from its offsets after the page changed it.
   * A live Range collapses, silently, when the page writes the same text
   * into a text node again (a framework re-render); the offsets survive.
   * Text that moved is found again by its surface, text that is gone is
   * let go.
   */
  private resolveBlock(block: Element) {
    if (!block.isConnected) {
      for (const record of this.registry.recordsIn(block)) this.remove(record.id)
      return
    }
    const text = getBlockText(block)
    for (const record of this.registry.recordsIn(block)) {
      let { start, end } = record
      if (text.slice(start, end) !== record.surface) {
        const found = findNearestOccurrence(text, record.surface, start)
        if (found === null) {
          this.remove(record.id)
          continue
        }
        start = found
        end = found + record.surface.length
      }
      const range = offsetsToRange(block, start, end)
      if (!range) {
        this.remove(record.id)
        continue
      }
      const updated =
        start === record.start && end === record.end
          ? record
          : (this.registry.update(record.id, { start, end }) ?? record)
      this.marks.replace(this.ranges.get(record.id), range)
      this.ranges.set(record.id, range)
      this.layer.set(updated, range)
    }
  }
}

let controller: AnnotationController | null = null

/** The page's one controller, made on first use. */
export function getAnnotationController(
  options: AnnotationControllerOptions,
): AnnotationController {
  controller ??= new AnnotationController(options)
  return controller
}

export function peekAnnotationController(): AnnotationController | null {
  return controller
}

export function disposeAnnotationController() {
  controller?.dispose()
  controller = null
}
