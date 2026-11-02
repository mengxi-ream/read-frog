import type { AnnotationRecord } from "./types"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { ANNOTATION_HOST_ATTRIBUTE, GLOSS_GAP_PX, LAYER_CSS, UNDERLINE_OFFSET_PX } from "./styles"

// The glosses, drawn in a shadow root of their own on top of the page and
// placed from the ranges' client rects. Nothing is inserted into the page's
// own text, so a page that re-renders its paragraphs cannot throw them out.
//
// Positions are taken relative to the layer's host, which sits at the
// document's origin and scrolls with it: a window scroll moves host and text
// together and needs no work. Only a scroller inside the page, a resize or a
// reflow does, and every relayout reads all rects first and writes all
// transforms after — interleaving the two is a layout thrash per annotation.

export interface LineRect {
  left: number
  right: number
  top: number
  bottom: number
}

interface LayerEntry {
  record: AnnotationRecord
  range: Range
  group: HTMLElement
  lines: HTMLElement[]
  gloss: HTMLElement | null
  text: HTMLElement | null
  remove: HTMLElement
  hoverTimer: ReturnType<typeof setTimeout> | null
}

interface Frame {
  entry: LayerEntry
  lines: LineRect[]
  anchor: LineRect | null
  natural: number
  blockRect: DOMRect
  center: number
  y: number
  width: number
}

export interface AnnotationLayerOptions {
  /** Draw the underline here, under each line, where `::highlight()` cannot. */
  underlineInLayer: boolean
  removeLabel: string
  onRemove: (id: string) => void
}

const LINE_MERGE_RATIO = 0.5
/** How long the remove button stays after the pointer leaves the gloss: the gap to the button is a few pixels. */
const HOVER_GRACE_MS = 150
const REMOVE_GLYPH =
  '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/></svg>'

/**
 * Whether a text colour is light, meaning the page behind it is dark: the
 * remove button then takes the dark theme's greys. Reads `rgb()`/`rgba()`
 * as getComputedStyle gives them; anything else counts as dark text.
 */
export function toneForColor(color: string): "light" | "dark" {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color)
  if (!match) return "light"
  const channel = (value: string) => {
    const c = Number(value) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * channel(match[1]!) + 0.7152 * channel(match[2]!) + 0.0722 * channel(match[3]!)
  return luminance > 0.4 ? "dark" : "light"
}
const NEIGHBOUR_GAP_PX = 6
const SAME_LINE_TOLERANCE_PX = 2

/** A range's client rects, one per line: the fragments on a line are merged. */
export function mergeLineRects(rects: ArrayLike<DOMRect>): LineRect[] {
  const lines: LineRect[] = []
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!
    if (rect.width <= 0 || rect.height <= 0) continue
    const line = lines.find((candidate) => {
      const overlap = Math.min(candidate.bottom, rect.bottom) - Math.max(candidate.top, rect.top)
      return overlap > LINE_MERGE_RATIO * Math.min(candidate.bottom - candidate.top, rect.height)
    })
    if (line) {
      line.left = Math.min(line.left, rect.left)
      line.right = Math.max(line.right, rect.right)
      line.top = Math.min(line.top, rect.top)
      line.bottom = Math.max(line.bottom, rect.bottom)
    } else {
      lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
    }
  }
  return lines
}

/**
 * How wide each gloss on a line may be: neighbours share the distance between
 * their centres, less a gap, and a gloss is never narrower than its word. The
 * floor is what keeps the box still when the meaning arrives: the skeleton is
 * the word's width, and a meaning that fits inside it changes nothing. A
 * gloss cut short fades out at its end (see `.clip`).
 */
export function allocateGlossWidths(
  glosses: Array<{ center: number; y: number; natural: number; wordWidth: number }>,
): number[] {
  type Indexed = (typeof glosses)[number] & { index: number }
  const lines: Indexed[][] = []
  glosses.forEach((gloss, index) => {
    const line = lines.find(
      (candidate) => Math.abs(candidate[0]!.y - gloss.y) <= SAME_LINE_TOLERANCE_PX,
    )
    if (line) {
      line.push({ ...gloss, index })
    } else {
      lines.push([{ ...gloss, index }])
    }
  })
  const widths = new Array<number>(glosses.length).fill(0)
  for (const line of lines) {
    line.sort((a, b) => a.center - b.center)
    line.forEach((gloss, position) => {
      let available = Number.POSITIVE_INFINITY
      const previous = line[position - 1]
      const next = line[position + 1]
      if (previous)
        available = Math.min(available, gloss.center - previous.center - NEIGHBOUR_GAP_PX)
      if (next) available = Math.min(available, next.center - gloss.center - NEIGHBOUR_GAP_PX)
      widths[gloss.index] =
        gloss.natural < gloss.wordWidth
          ? gloss.wordWidth
          : Math.min(gloss.natural, Math.max(available, gloss.wordWidth))
    })
  }
  return widths
}

export class AnnotationLayer {
  private host: HTMLElement | null = null
  private container: HTMLElement | null = null
  private readonly entries = new Map<string, LayerEntry>()
  private frame: number | null = null
  private listeners: AbortController | null = null

  constructor(private readonly options: AnnotationLayerOptions) {}

  get size() {
    return this.entries.size
  }

  has(id: string) {
    return this.entries.has(id)
  }

  /** Shows a record, or updates the one shown; `range` is required the first time. */
  set(record: AnnotationRecord, range?: Range) {
    const container = this.ensureMounted()
    let entry = this.entries.get(record.id)
    let swap = false
    if (!entry) {
      if (!range) return
      entry = this.createEntry(record, range)
      container.append(entry.group)
      this.entries.set(record.id, entry)
    } else {
      swap = entry.record.status === "loading" && record.status !== "loading"
      entry.record = record
      if (range) entry.range = range
    }
    this.applyState(entry, swap)
    this.scheduleRelayout()
  }

  delete(id: string) {
    const entry = this.entries.get(id)
    if (!entry) return
    if (entry.hoverTimer !== null) clearTimeout(entry.hoverTimer)
    entry.group.remove()
    this.entries.delete(id)
    if (this.entries.size === 0) {
      this.unmount()
    } else {
      this.scheduleRelayout()
    }
  }

  scheduleRelayout() {
    if (this.frame !== null || !this.host) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      this.relayout()
    })
  }

  relayout() {
    const host = this.host
    const container = this.container
    if (!host || !container || !host.isConnected) return

    // Read everything first.
    const hostRect = host.getBoundingClientRect()
    const blockRects = new Map<Element, DOMRect>()
    const frames: Frame[] = []
    for (const entry of this.entries.values()) {
      const { block } = entry.record
      if (!block.isConnected) {
        frames.push({
          entry,
          lines: [],
          anchor: null,
          natural: 0,
          blockRect: hostRect,
          center: 0,
          y: 0,
          width: 0,
        })
        continue
      }
      let blockRect = blockRects.get(block)
      if (!blockRect) {
        blockRect = block.getBoundingClientRect()
        blockRects.set(block, blockRect)
      }
      let lines: LineRect[]
      try {
        lines = mergeLineRects(entry.range.getClientRects())
      } catch {
        lines = []
      }
      let anchor: LineRect | null = null
      for (const line of lines) {
        if (!anchor || line.right - line.left > anchor.right - anchor.left) anchor = line
      }
      const natural = entry.text ? entry.text.getBoundingClientRect().width : 0
      frames.push({
        entry,
        lines,
        anchor,
        natural,
        blockRect,
        center: anchor ? (anchor.left + anchor.right) / 2 : 0,
        y: anchor ? anchor.bottom : 0,
        width: 0,
      })
    }

    // Glosses on one line share it.
    const byBlock = new Map<Element, Frame[]>()
    for (const frame of frames) {
      if (!frame.anchor || !frame.entry.gloss) continue
      const group = byBlock.get(frame.entry.record.block) ?? []
      group.push(frame)
      byBlock.set(frame.entry.record.block, group)
    }
    for (const group of byBlock.values()) {
      const widths = allocateGlossWidths(
        group.map((frame) => ({
          center: frame.center,
          y: frame.y,
          natural: frame.natural,
          wordWidth: frame.anchor!.right - frame.anchor!.left,
        })),
      )
      group.forEach((frame, index) => {
        frame.width = widths[index]!
      })
    }

    // Then write everything.
    for (const frame of frames) {
      const { entry, lines, anchor, blockRect } = frame
      while (entry.lines.length < lines.length) {
        const line = document.createElement("div")
        line.className = "u"
        this.bindHover(entry, line)
        entry.group.append(line)
        entry.lines.push(line)
      }
      while (entry.lines.length > lines.length) entry.lines.pop()!.remove()
      lines.forEach((line, index) => {
        const element = entry.lines[index]!
        element.style.width = `${line.right - line.left}px`
        element.style.transform = `translate(${line.left - hostRect.left}px, ${line.bottom - hostRect.top + UNDERLINE_OFFSET_PX - 1}px)`
      })

      if (!anchor) {
        if (entry.gloss) entry.gloss.style.display = "none"
        entry.remove.style.display = "none"
        continue
      }

      const glossY = anchor.bottom - hostRect.top + UNDERLINE_OFFSET_PX + GLOSS_GAP_PX + 1
      let removeX = anchor.right - hostRect.left + 2
      let removeY = anchor.bottom - hostRect.top + UNDERLINE_OFFSET_PX - 8
      if (entry.gloss) {
        const width = Math.max(0, frame.width)
        const left = Math.max(
          blockRect.left,
          Math.min(frame.center - width / 2, blockRect.right - width),
        )
        entry.gloss.style.display = ""
        entry.gloss.style.width = `${width}px`
        entry.gloss.style.transform = `translate(${left - hostRect.left}px, ${glossY}px)`
        entry.gloss.classList.toggle(
          "clip",
          entry.record.status !== "loading" && width + 0.5 < frame.natural,
        )
        // Beside the text itself, not the box: the box is at least the word's
        // width and the text sits centred in it, so a short meaning would
        // otherwise leave the button a long way off. A clipped text starts at
        // the box's left edge and fills it; the skeleton fills it too.
        const textWidth = entry.record.status === "loading" ? width : Math.min(frame.natural, width)
        const textLeft = left + Math.max(0, (width - textWidth) / 2)
        removeX = textLeft - hostRect.left + textWidth + 2
        removeY = glossY - 0.5
      }
      entry.remove.style.display = ""
      entry.remove.style.transform = `translate(${removeX}px, ${removeY}px)`
    }
  }

  dispose() {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    for (const entry of this.entries.values()) entry.group.remove()
    this.entries.clear()
    this.unmount()
  }

  private createEntry(record: AnnotationRecord, range: Range): LayerEntry {
    const group = document.createElement("div")
    group.className = "a"
    group.dataset.rfId = record.id

    let gloss: HTMLElement | null = null
    let text: HTMLElement | null = null
    if (record.glossFits) {
      gloss = document.createElement("div")
      gloss.className = "g"
      text = document.createElement("span")
      text.className = "t"
      const skeleton = document.createElement("span")
      skeleton.className = "sk"
      gloss.append(text, skeleton)
      group.append(gloss)
    }

    const remove = document.createElement("button")
    remove.type = "button"
    remove.className = "x"
    remove.innerHTML = REMOVE_GLYPH
    remove.setAttribute("aria-label", this.options.removeLabel)
    remove.title = this.options.removeLabel
    // The page's own selection handling must not see the click.
    remove.addEventListener("pointerdown", (event) => event.stopPropagation())
    remove.addEventListener("mousedown", (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    remove.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.options.onRemove(record.id)
    })
    group.append(remove)

    const entry: LayerEntry = {
      record,
      range,
      group,
      lines: [],
      gloss,
      text,
      remove,
      hoverTimer: null,
    }
    if (gloss) this.bindHover(entry, gloss)
    this.bindHover(entry, remove)
    return entry
  }

  // The button shows while the pointer is on any part of the annotation and
  // for a moment after it leaves: CSS :hover alone drops the instant the
  // pointer is in the gap between the gloss and the button.
  private bindHover(entry: LayerEntry, element: HTMLElement) {
    element.addEventListener("pointerenter", () => {
      if (entry.hoverTimer !== null) clearTimeout(entry.hoverTimer)
      entry.hoverTimer = null
      entry.group.classList.add("hover")
    })
    element.addEventListener("pointerleave", () => {
      if (entry.hoverTimer !== null) clearTimeout(entry.hoverTimer)
      entry.hoverTimer = setTimeout(() => {
        entry.hoverTimer = null
        entry.group.classList.remove("hover")
      }, HOVER_GRACE_MS)
    })
  }

  // `swap` is the moment the meaning replaces the skeleton: the box may grow
  // then, once, with a transition. The class goes again right after, so a
  // relayout for a scroll moves the box at once rather than easing after it.
  private applyState(entry: LayerEntry, swap = false) {
    const { record, group, gloss, text } = entry
    const color = getComputedStyle(record.block).color
    group.style.setProperty("--c", color)
    group.dataset.tone = toneForColor(color)
    if (gloss && text) {
      text.textContent = record.gloss ?? ""
      gloss.classList.toggle("loading", record.status === "loading")
      if (swap) {
        gloss.classList.add("swap")
        setTimeout(() => gloss.classList.remove("swap"), 300)
      }
    }
  }

  private ensureMounted(): HTMLElement {
    if (!this.host) {
      const host = document.createElement("div")
      host.className = NOTRANSLATE_CLASS
      host.setAttribute("translate", "no")
      host.setAttribute(ANNOTATION_HOST_ATTRIBUTE, "")
      host.style.cssText = `
        all: initial !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        overflow: visible !important;
        z-index: 2147483646 !important;
        pointer-events: none !important;
      `
      // Open, unlike the translation preview's ring: the page cannot style
      // it either way, and an open root is what end-to-end tests can read.
      const root = host.attachShadow({ mode: "open" })
      const style = document.createElement("style")
      style.textContent = LAYER_CSS
      const container = document.createElement("div")
      container.className = this.options.underlineInLayer ? "layer fallback" : "layer"
      root.append(style, container)
      this.host = host
      this.container = container
    }
    if (!this.host.isConnected) document.documentElement.append(this.host)
    this.listen()
    return this.container!
  }

  private unmount() {
    this.listeners?.abort()
    this.listeners = null
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.host?.remove()
  }

  private listen() {
    if (this.listeners) return
    const controller = new AbortController()
    const { signal } = controller
    const relayout = () => this.scheduleRelayout()
    window.addEventListener("resize", relayout, { signal })
    // A window scroll moves the host with the text. Anything else that
    // scrolls — a column, a dialog — moves the text alone.
    document.addEventListener(
      "scroll",
      (event) => {
        if (event.target !== document) relayout()
      },
      { capture: true, passive: true, signal },
    )
    document.fonts?.ready.then(relayout, () => {})
    this.listeners = controller
  }
}
