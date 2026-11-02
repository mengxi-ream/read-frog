import { ANNOTATION_HIGHLIGHT_NAME } from "./styles"

// The marks: one CSS Custom Highlight holding every annotated range. The
// engine paints it with the text, so it needs no repositioning, and it costs
// a couple of milliseconds for a thousand ranges where wrapping the text in
// elements costs a second and a half — and nothing is written into the page.
//
// Typed locally: lib.dom gained these late, and the shim is all that is used.

interface HighlightLike {
  add(range: AbstractRange): void
  delete(range: AbstractRange): boolean
  clear(): void
}

interface HighlightRegistryLike {
  set(name: string, highlight: HighlightLike): void
  delete(name: string): boolean
}

type HighlightConstructor = new () => HighlightLike

function getHighlightConstructor(): HighlightConstructor | null {
  const ctor = (globalThis as { Highlight?: unknown }).Highlight
  return typeof ctor === "function" ? (ctor as HighlightConstructor) : null
}

function getHighlightRegistry(): HighlightRegistryLike | null {
  const css = (globalThis as { CSS?: { highlights?: unknown } }).CSS
  const registry = css?.highlights as HighlightRegistryLike | undefined
  return registry && typeof registry.set === "function" ? registry : null
}

export function supportsHighlightApi(): boolean {
  return getHighlightConstructor() !== null && getHighlightRegistry() !== null
}

/**
 * Whether `text-decoration` works inside `::highlight()`. Firefox paints
 * highlights from 140 but ignores the decoration until 146; the layer draws
 * the underline itself there.
 */
export function supportsHighlightTextDecoration(): boolean {
  const match = /Firefox\/(\d+)/.exec(navigator.userAgent)
  return match ? Number(match[1]) >= 146 : true
}

export class AnnotationMarks {
  private highlight: HighlightLike | null = null
  private registered = false

  get available() {
    return supportsHighlightApi()
  }

  add(range: Range) {
    const highlight = this.ensure()
    highlight?.add(range)
  }

  remove(range: Range) {
    this.highlight?.delete(range)
  }

  replace(previous: Range | undefined, next: Range) {
    if (previous) this.remove(previous)
    this.add(next)
  }

  clear() {
    this.highlight?.clear()
  }

  dispose() {
    this.highlight?.clear()
    if (this.registered) getHighlightRegistry()?.delete(ANNOTATION_HIGHLIGHT_NAME)
    this.highlight = null
    this.registered = false
  }

  private ensure(): HighlightLike | null {
    if (this.highlight) return this.highlight
    const Ctor = getHighlightConstructor()
    const registry = getHighlightRegistry()
    if (!Ctor || !registry) return null
    this.highlight = new Ctor()
    registry.set(ANNOTATION_HIGHLIGHT_NAME, this.highlight)
    this.registered = true
    return this.highlight
  }
}
