import { supportsHighlightApi } from "@/utils/annotate/marks"

// The marks, as CSS Custom Highlights: nothing is written into the page, and
// the engine paints them with the text. One highlight per kind of word and
// tone of page — a paragraph of light text on a dark page takes the dark
// colours — and one more for the word under the pointer.
//
// Below the annotation underline (priority -1 against its 0), so a word that
// is both marked and annotated shows both; the hover above everything.
//
// Typed locally, as in utils/annotate/marks.ts: lib.dom gained these late.

export type MarkKind = "hard" | "learning"
/** The page behind the word: "dark" when its text is light. */
export type MarkTone = "light" | "dark"

interface HighlightLike {
  priority: number
  add(range: AbstractRange): void
  delete(range: AbstractRange): boolean
  clear(): void
}

interface HighlightRegistryLike {
  set(name: string, highlight: HighlightLike): void
  delete(name: string): boolean
}

type HighlightConstructor = new () => HighlightLike

const BASE_PRIORITY = -1
const HOVER_PRIORITY = 1

export function highlightName(kind: MarkKind, tone: MarkTone, hover = false): string {
  return `read-frog-${kind}${hover ? "-hover" : ""}${tone === "dark" ? "-dark" : ""}`
}

export const HIGHLIGHT_NAMES = (["hard", "learning"] as const).flatMap((kind) =>
  (["light", "dark"] as const).flatMap((tone) => [
    highlightName(kind, tone),
    highlightName(kind, tone, true),
  ]),
)

function getRegistry(): HighlightRegistryLike | null {
  const registry = (globalThis as { CSS?: { highlights?: unknown } }).CSS?.highlights as
    | HighlightRegistryLike
    | undefined
  return registry && typeof registry.set === "function" ? registry : null
}

export class DifficultWordHighlights {
  private readonly highlights = new Map<string, HighlightLike>()
  private hover: { name: string; range: Range } | null = null

  get available() {
    return supportsHighlightApi()
  }

  add(kind: MarkKind, tone: MarkTone, range: Range) {
    this.ensure(highlightName(kind, tone), BASE_PRIORITY)?.add(range)
  }

  remove(kind: MarkKind, tone: MarkTone, range: Range) {
    this.highlights.get(highlightName(kind, tone))?.delete(range)
    if (this.hover?.range === range) this.setHover(null)
  }

  /** Deepens one mark, the one under the pointer; `null` for none. */
  setHover(mark: { kind: MarkKind; tone: MarkTone; range: Range } | null) {
    if (this.hover) this.highlights.get(this.hover.name)?.delete(this.hover.range)
    this.hover = null
    if (!mark) return
    const name = highlightName(mark.kind, mark.tone, true)
    this.ensure(name, HOVER_PRIORITY)?.add(mark.range)
    this.hover = { name, range: mark.range }
  }

  clear() {
    for (const highlight of this.highlights.values()) highlight.clear()
    this.hover = null
  }

  dispose() {
    this.clear()
    const registry = getRegistry()
    for (const name of this.highlights.keys()) registry?.delete(name)
    this.highlights.clear()
  }

  private ensure(name: string, priority: number): HighlightLike | null {
    const existing = this.highlights.get(name)
    if (existing) return existing
    const Ctor = (globalThis as { Highlight?: unknown }).Highlight as
      | HighlightConstructor
      | undefined
    const registry = getRegistry()
    if (typeof Ctor !== "function" || !registry) return null
    const highlight = new Ctor()
    highlight.priority = priority
    registry.set(name, highlight)
    this.highlights.set(name, highlight)
    return highlight
  }
}
