/** Where an annotation came from. v1 has the reader's own selections only. */
export type AnnotationSource = "manual"

export type AnnotationStatus = "loading" | "ready"

/**
 * One annotated span. Its truth is the block and the offsets into the block's
 * text (see text-offsets.ts), not a Range: a page that rewrites its text
 * nodes collapses a live Range without a word, and the offsets rebuild one.
 */
export interface AnnotationRecord {
  id: string
  /** The block the text lives in. The record goes when the block does. */
  block: Element
  start: number
  end: number
  /** The text at the offsets when the record was made; a rebuild checks it. */
  surface: string
  sourceId: AnnotationSource
  status: AnnotationStatus
  /** The meaning shown between the lines; `null` while it is on its way. */
  gloss: string | null
  /** False when the block cannot make room between its lines: mark only. */
  glossFits: boolean
  createdAt: number
}
