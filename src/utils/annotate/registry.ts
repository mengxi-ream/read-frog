import type { AnnotationRecord } from "./types"

/**
 * The annotations on the page, by id and by block. Plain state with
 * listeners: the renderer and the React UI both read it, and neither owns it.
 */
export class AnnotationRegistry {
  private readonly records = new Map<string, AnnotationRecord>()
  private readonly byBlock = new Map<Element, Set<string>>()
  private readonly listeners = new Set<() => void>()
  private snapshot: AnnotationRecord[] = []

  get size() {
    return this.records.size
  }

  get(id: string): AnnotationRecord | undefined {
    return this.records.get(id)
  }

  /** Every record, in insertion order. Stable between changes, for useSyncExternalStore. */
  all(): AnnotationRecord[] {
    return this.snapshot
  }

  blocks(): Element[] {
    return [...this.byBlock.keys()]
  }

  recordsIn(block: Element): AnnotationRecord[] {
    const ids = this.byBlock.get(block)
    if (!ids) return []
    const records: AnnotationRecord[] = []
    for (const id of ids) {
      const record = this.records.get(id)
      if (record) records.push(record)
    }
    return records
  }

  /**
   * The annotations a new span over `[start, end)` of `block` touches, whether
   * it contains them or only crosses them. A new annotation replaces them all:
   * two meanings cannot share one gap between the lines.
   */
  overlapping(block: Element, start: number, end: number): AnnotationRecord[] {
    return this.recordsIn(block).filter((record) => record.start < end && start < record.end)
  }

  add(record: AnnotationRecord) {
    this.records.set(record.id, record)
    let ids = this.byBlock.get(record.block)
    if (!ids) {
      ids = new Set()
      this.byBlock.set(record.block, ids)
    }
    ids.add(record.id)
    this.emit()
  }

  update(
    id: string,
    patch: Partial<Omit<AnnotationRecord, "id" | "block">>,
  ): AnnotationRecord | null {
    const current = this.records.get(id)
    if (!current) return null
    const next = { ...current, ...patch }
    this.records.set(id, next)
    this.emit()
    return next
  }

  remove(id: string): AnnotationRecord | null {
    const record = this.records.get(id)
    if (!record) return null
    this.records.delete(id)
    const ids = this.byBlock.get(record.block)
    ids?.delete(id)
    if (ids?.size === 0) this.byBlock.delete(record.block)
    this.emit()
    return record
  }

  removeBlock(block: Element): AnnotationRecord[] {
    const removed = this.recordsIn(block)
    for (const record of removed) this.records.delete(record.id)
    this.byBlock.delete(block)
    if (removed.length > 0) this.emit()
    return removed
  }

  clear(): AnnotationRecord[] {
    const removed = [...this.records.values()]
    this.records.clear()
    this.byBlock.clear()
    if (removed.length > 0) this.emit()
    return removed
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    this.snapshot = [...this.records.values()]
    for (const listener of this.listeners) listener()
  }
}
