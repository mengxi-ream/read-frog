import type { AnnotationRecord } from "./types"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { AnnotationLayer } from "./layer"
import {
  applyLeadingRung,
  clearLeadingRung,
  findLineHeightOwner,
  isLeadingClipped,
  isLeadingUnsafe,
  isTooSmallForGloss,
  leadingRungFor,
  measureLeading,
} from "./leading"
import { AnnotationMarks, supportsHighlightTextDecoration } from "./marks"
import { AnnotationRegistry } from "./registry"
import {
  ANNOTATION_LEADING_ATTRIBUTE,
  ensureAnnotationDocumentStyles,
  removeAnnotationDocumentStyles,
} from "./styles"
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
  /** Whether the block's lines can be given room for glosses at all. */
  glossFits: boolean
  /** The elements carrying a line-height rung one of the block's annotations needed. */
  leadingOwners: Set<Element>
}

const BLOCK_OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  characterData: true,
  subtree: true,
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
  // A block's own observer cannot see the block leave the page — its parent's
  // child list changes, not its own — so removals anywhere are checked for it.
  private readonly removals = new MutationObserver(() => {
    for (const block of this.blocks.keys()) {
      if (!block.isConnected) this.dirtyBlocks.add(block)
    }
    this.queueResolve()
  })
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
    // Rebuilt from the offsets, it starts in the text holding the first
    // character. The selection may start at the end of the text before it
    // (a small @mention, a timestamp), whose size is not the word's.
    const liveRange = offsetsToRange(block, offsets.start, offsets.end)
    if (!liveRange) return { ok: false, reason: "noBlock" }

    const replaced = this.registry
      .overlapping(block, offsets.start, offsets.end)
      .map((record) => record.id)
    for (const id of replaced) this.remove(id)

    ensureAnnotationDocumentStyles()
    const probe = liveRange.startContainer instanceof Text ? liveRange.startContainer : null
    const state = this.ensureBlock(block)
    const glossFits = this.makeRoom(block, state, probe)

    const record: AnnotationRecord = {
      id: getRandomUUID(),
      block,
      start: offsets.start,
      end: offsets.end,
      surface,
      sourceId: "manual",
      status: "loading",
      gloss: null,
      glossFits,
      createdAt: Date.now(),
    }
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
    this.removals.disconnect()
    this.resizes?.disconnect()
    for (const block of this.blocks.keys()) this.clearLeading(block)
    this.blocks.clear()
    this.ranges.clear()
    this.registry.clear()
    this.marks.dispose()
    this.layer.dispose()
    removeAnnotationDocumentStyles()
  }

  // A block is watched from its first annotation and let go after its last.
  private ensureBlock(block: Element): BlockState {
    let state = this.blocks.get(block)
    if (state) return state
    state = { glossFits: !isLeadingUnsafe(block), leadingOwners: new Set() }
    if (this.blocks.size === 0) {
      this.removals.observe(document.documentElement, { childList: true, subtree: true })
    }
    this.blocks.set(block, state)
    this.mutations.observe(block, BLOCK_OBSERVE_OPTIONS)
    this.resizes?.observe(block)
    return state
  }

  /**
   * Makes room under the line the probe's text sits on, and says whether a
   * gloss fits there. Per annotation, not per block: the line-height owner of
   * one word (a `<code>` with its own) is not that of the next, nor is its size.
   */
  private makeRoom(block: Element, state: BlockState, probe: Text | null): boolean {
    if (!state.glossFits) return false
    const measurement = measureLeading(block, probe)
    if (!measurement || isTooSmallForGloss(measurement)) return false
    const rung = leadingRungFor(measurement)
    if (rung !== null) {
      const owner = findLineHeightOwner(block, probe)
      const previous = owner.getAttribute(ANNOTATION_LEADING_ATTRIBUTE)
      applyLeadingRung(owner, rung)
      if (isLeadingClipped(block)) {
        // A fixed-height box hiding its overflow: taller lines would be cut off.
        if (previous === null) clearLeadingRung(owner)
        else owner.setAttribute(ANNOTATION_LEADING_ATTRIBUTE, previous)
        state.glossFits = false
        return false
      }
      state.leadingOwners.add(owner)
    }
    return true
  }

  private releaseBlock(block: Element) {
    // Records already queued for the other blocks would go with the disconnect.
    this.onMutations(this.mutations.takeRecords())
    this.clearLeading(block)
    this.blocks.delete(block)
    this.resizes?.unobserve(block)
    // A MutationObserver has no unobserve: start over with the blocks left.
    this.mutations.disconnect()
    for (const observed of this.blocks.keys()) {
      this.mutations.observe(observed, BLOCK_OBSERVE_OPTIONS)
    }
    if (this.blocks.size === 0) this.removals.disconnect()
    // A rung is inherited: a block nested in this one may have found its room
    // in this block's rung, gone now. Make its own.
    for (const [nested, state] of this.blocks) {
      if (!block.contains(nested)) continue
      for (const record of this.registry.recordsIn(nested)) {
        if (!record.glossFits) continue
        const probe = this.ranges.get(record.id)?.startContainer
        this.makeRoom(nested, state, probe instanceof Text ? probe : null)
      }
    }
  }

  private clearLeading(block: Element) {
    const owners = this.blocks.get(block)?.leadingOwners
    if (owners) for (const owner of owners) clearLeadingRung(owner)
  }

  private onMutations(records: MutationRecord[]) {
    for (const mutation of records) {
      let node: Node | null = mutation.target
      while (node && !(node instanceof Element && this.blocks.has(node))) node = node.parentNode
      if (node instanceof Element) this.dirtyBlocks.add(node)
    }
    this.queueResolve()
  }

  private queueResolve() {
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
