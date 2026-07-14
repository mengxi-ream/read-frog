import type { VirtualParagraphSourceSnapshot } from "../core/translation-state"
import type { Config } from "@/types/config/config"
import {
  isDontWalkIntoAndDontTranslateAsChildElement,
  isDontWalkIntoButTranslateAsChildElement,
  isHTMLElement,
  isTextNode,
  isTranslatedContentNode,
  isTranslatedWrapperNode,
} from "../../dom/filter"

const PRESERVED_NEWLINE_WHITE_SPACE = new Set(["pre", "pre-wrap", "pre-line", "break-spaces"])

const BLANK_LINE_DELIMITER_RE = /(?:\r\n?|\n)[^\S\r\n]*(?:\r\n?|\n)(?:[^\S\r\n]*(?:\r\n?|\n))*/g

const PROTECTED_INSERTION_TAGS = new Set(["A", "BUTTON"])

const HORIZONTAL_WHITESPACE_RE = /^[^\S\r\n]*$/

export interface DOMBoundary {
  container: Node
  offset: number
}

export interface VirtualParagraphSourceFragment {
  source: Text | HTMLElement
  startOffset: number
  endOffset: number
  atomic: boolean
}

export interface VirtualParagraphUnit {
  id: number
  text: string
  insertionBoundary: DOMBoundary
  sourceFragments: VirtualParagraphSourceFragment[]
}

export interface VirtualParagraphPlan {
  units: VirtualParagraphUnit[]
  sourceSnapshots: VirtualParagraphSourceSnapshot[]
}

interface RawSourceChunk {
  source: Text | HTMLElement
  streamStart: number
  streamEnd: number
  atomic: boolean
  delimiterEligible: boolean
}

interface StreamState {
  chunks: RawSourceChunk[]
  parts: string[]
  barriers: Set<number>
  length: number
}

interface RawDelimiter {
  start: number
  end: number
}

interface RawSegment {
  start: number
  end: number
  insertionIndex: number
}

function appendChunk(
  state: StreamState,
  source: Text | HTMLElement,
  text: string,
  atomic: boolean,
  delimiterEligible: boolean,
): void {
  if (text === "") return

  const streamStart = state.length
  state.parts.push(text)
  state.length += text.length
  state.chunks.push({
    source,
    streamStart,
    streamEnd: state.length,
    atomic,
    delimiterEligible,
  })
}

function addBarrier(state: StreamState): void {
  state.barriers.add(state.length)
}

function collectRawSource(
  element: HTMLElement,
  config: Config,
  state: StreamState,
  delimiterEligible: boolean = true,
): void {
  for (const child of element.childNodes) {
    if (isTextNode(child)) {
      appendChunk(state, child, child.data, false, delimiterEligible)
      continue
    }

    if (!isHTMLElement(child)) continue

    if (
      isTranslatedWrapperNode(child) ||
      isTranslatedContentNode(child) ||
      isDontWalkIntoAndDontTranslateAsChildElement(child, config)
    ) {
      // Excluded DOM must not make otherwise separated newline characters
      // look adjacent in the virtual text stream.
      addBarrier(state)
      continue
    }

    if (isDontWalkIntoButTranslateAsChildElement(child, config)) {
      appendChunk(state, child, child.textContent ?? "", true, false)
      // Empty atomic elements still separate the source on either side.
      if (!child.textContent) addBarrier(state)
      continue
    }

    const childDelimiterEligible = delimiterEligible && !PROTECTED_INSERTION_TAGS.has(child.tagName)
    collectRawSource(child, config, state, childDelimiterEligible)
  }
}

function findDelimiterEligibleIntervals(state: StreamState): Array<[number, number]> {
  const intervals: Array<[number, number]> = []
  let intervalStart: number | undefined
  let intervalEnd = 0

  const closeInterval = () => {
    if (intervalStart !== undefined && intervalEnd > intervalStart) {
      intervals.push([intervalStart, intervalEnd])
    }
    intervalStart = undefined
  }

  for (const chunk of state.chunks) {
    if (!chunk.delimiterEligible) {
      closeInterval()
      continue
    }

    const canJoinPrevious =
      intervalStart !== undefined &&
      chunk.streamStart === intervalEnd &&
      !state.barriers.has(chunk.streamStart)

    if (!canJoinPrevious) {
      closeInterval()
      intervalStart = chunk.streamStart
    }
    intervalEnd = chunk.streamEnd
  }

  closeInterval()
  return intervals
}

function findBlankLineDelimiters(stream: string, state: StreamState): RawDelimiter[] {
  const delimiters: RawDelimiter[] = []

  for (const [intervalStart, intervalEnd] of findDelimiterEligibleIntervals(state)) {
    const intervalText = stream.slice(intervalStart, intervalEnd)
    for (const match of intervalText.matchAll(BLANK_LINE_DELIMITER_RE)) {
      const start = intervalStart + (match.index ?? 0)
      delimiters.push({ start, end: start + match[0].length })
    }
  }

  return delimiters
}

function createRawSegments(streamLength: number, delimiters: RawDelimiter[]): RawSegment[] {
  const segments: RawSegment[] = []
  let start = 0

  for (const delimiter of delimiters) {
    segments.push({ start, end: delimiter.start, insertionIndex: delimiter.start })
    start = delimiter.end
  }

  segments.push({ start, end: streamLength, insertionIndex: streamLength })
  return segments
}

function createSourceFragments(
  chunks: RawSourceChunk[],
  contentStart: number,
  contentEnd: number,
): VirtualParagraphSourceFragment[] {
  const fragments: VirtualParagraphSourceFragment[] = []

  for (const chunk of chunks) {
    const intersectionStart = Math.max(contentStart, chunk.streamStart)
    const intersectionEnd = Math.min(contentEnd, chunk.streamEnd)
    if (intersectionStart >= intersectionEnd) continue

    fragments.push({
      source: chunk.source,
      startOffset: intersectionStart - chunk.streamStart,
      endOffset: intersectionEnd - chunk.streamStart,
      atomic: chunk.atomic,
    })
  }

  return fragments
}

function createSourceSnapshots(chunks: RawSourceChunk[]): VirtualParagraphSourceSnapshot[] {
  const snapshots = new Map<Text | HTMLElement, VirtualParagraphSourceSnapshot>()
  for (const { source } of chunks) {
    if (snapshots.has(source)) continue
    snapshots.set(source, {
      source,
      parent: source.parentNode,
      value: isTextNode(source) ? source.data : (source.textContent ?? ""),
    })
  }
  return [...snapshots.values()]
}

function boundaryAfterElement(element: HTMLElement): DOMBoundary | undefined {
  const parent = element.parentNode
  if (!parent) return undefined

  const index = [...parent.childNodes].indexOf(element)
  if (index === -1) return undefined
  return { container: parent, offset: index + 1 }
}

function boundaryAtStreamOffset(
  chunks: RawSourceChunk[],
  streamOffset: number,
  layoutSource: HTMLElement,
): DOMBoundary {
  const containingChunk = chunks.find(
    (chunk) => chunk.streamStart <= streamOffset && streamOffset < chunk.streamEnd,
  )

  if (containingChunk) {
    if (isTextNode(containingChunk.source)) {
      return {
        container: containingChunk.source,
        offset: streamOffset - containingChunk.streamStart,
      }
    }

    return (
      boundaryAfterElement(containingChunk.source) ?? {
        container: layoutSource,
        offset: layoutSource.childNodes.length,
      }
    )
  }

  let precedingChunk: RawSourceChunk | undefined
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    if (chunks[index].streamEnd <= streamOffset) {
      precedingChunk = chunks[index]
      break
    }
  }
  if (!precedingChunk) {
    return { container: layoutSource, offset: 0 }
  }

  if (isTextNode(precedingChunk.source)) {
    return { container: precedingChunk.source, offset: precedingChunk.source.data.length }
  }

  return (
    boundaryAfterElement(precedingChunk.source) ?? {
      container: layoutSource,
      offset: layoutSource.childNodes.length,
    }
  )
}

function findProtectedBoundaryAncestor(
  boundary: DOMBoundary,
  layoutSource: HTMLElement,
  config: Config,
): HTMLElement | undefined {
  let current = isHTMLElement(boundary.container)
    ? boundary.container
    : boundary.container.parentElement
  let outermostProtected: HTMLElement | undefined

  while (current && current !== layoutSource) {
    if (
      PROTECTED_INSERTION_TAGS.has(current.tagName) ||
      isDontWalkIntoButTranslateAsChildElement(current, config)
    ) {
      outermostProtected = current
    }
    current = current.parentElement
  }

  return outermostProtected
}

function liftEdgeBoundary(boundary: DOMBoundary, layoutSource: HTMLElement): DOMBoundary {
  let current = boundary

  while (current.container !== layoutSource) {
    if (isTextNode(current.container)) {
      if (current.offset !== 0 && current.offset !== current.container.data.length) break

      const parent = current.container.parentNode
      if (!parent) break
      const index = [...parent.childNodes].indexOf(current.container)
      if (index === -1) break

      current = {
        container: parent,
        offset: index + (current.offset === current.container.data.length ? 1 : 0),
      }
      continue
    }

    const childCount = current.container.childNodes.length
    if (current.offset !== 0 && current.offset !== childCount) break

    const parent = current.container.parentNode
    if (!parent) break
    const index = [...parent.childNodes].indexOf(current.container as ChildNode)
    if (index === -1) break

    current = {
      container: parent,
      offset: index + (current.offset === childCount ? 1 : 0),
    }
  }

  return current
}

/**
 * Lift terminal boundaries out of controls and atomic inline content. This is
 * intentionally limited to boundaries at a paragraph edge; a boundary in the
 * middle of an ordinary Text node stays in that Text node for splitText/Range.
 */
export function liftParagraphInsertionBoundary(
  boundary: DOMBoundary,
  layoutSource: HTMLElement,
  config: Config,
): DOMBoundary {
  const protectedAncestor = findProtectedBoundaryAncestor(boundary, layoutSource, config)
  const outsideProtected = protectedAncestor
    ? (boundaryAfterElement(protectedAncestor) ?? boundary)
    : boundary

  return liftEdgeBoundary(outsideProtected, layoutSource)
}

function isHorizontalWhitespaceText(node: Node): node is Text {
  return isTextNode(node) && HORIZONTAL_WHITESPACE_RE.test(node.data)
}

function isVisibleInlineImageWithAlt(node: Node): node is HTMLImageElement {
  if (!isHTMLElement(node) || node.tagName !== "IMG" || !node.getAttribute("alt")?.trim()) {
    return false
  }

  const computedStyle = window.getComputedStyle(node)
  return (
    computedStyle.visibility !== "hidden" &&
    computedStyle.display.trim().toLowerCase().startsWith("inline")
  )
}

/**
 * Keep textless inline images such as X/Twitter's twemoji with the source
 * paragraph for layout purposes. Their alt text is intentionally not added to
 * the translation stream: this only moves the bilingual wrapper boundary.
 */
export function moveParagraphInsertionBoundaryAfterTrailingInlineImages(
  boundary: DOMBoundary,
  layoutSource: HTMLElement,
): DOMBoundary {
  const originalBoundary = boundary
  let container = boundary.container
  let offset = boundary.offset
  let committedBoundary = originalBoundary
  let sawInlineImage = false

  if (isTextNode(container)) {
    if (offset !== container.data.length) return originalBoundary
    const parent = container.parentNode
    if (!parent) return originalBoundary
    const index = [...parent.childNodes].indexOf(container)
    if (index === -1) return originalBoundary
    container = parent
    offset = index + 1
  }

  while (container === layoutSource || layoutSource.contains(container)) {
    const children = [...container.childNodes]
    let index = offset

    while (index < children.length) {
      const child = children[index]

      if (isHorizontalWhitespaceText(child)) {
        if (sawInlineImage) {
          committedBoundary = { container, offset: index + 1 }
        }
        index += 1
        continue
      }

      if (!isVisibleInlineImageWithAlt(child)) {
        return sawInlineImage ? committedBoundary : originalBoundary
      }

      sawInlineImage = true
      committedBoundary = { container, offset: index + 1 }
      index += 1
    }

    if (container === layoutSource) break

    const parent = container.parentNode
    if (!parent) break
    const indexInParent = [...parent.childNodes].indexOf(container as ChildNode)
    if (indexInParent === -1) break
    container = parent
    offset = indexInParent + 1
  }

  return sawInlineImage ? committedBoundary : originalBoundary
}

/**
 * Build virtual bilingual paragraphs from literal blank lines without changing
 * the host DOM. An empty result means the caller should use the existing
 * single-translation-unit path.
 */
export function buildVirtualParagraphPlan(
  layoutSource: HTMLElement,
  config: Config,
): VirtualParagraphPlan {
  const whiteSpace = window.getComputedStyle(layoutSource).whiteSpace.trim().toLowerCase()
  if (!PRESERVED_NEWLINE_WHITE_SPACE.has(whiteSpace)) {
    return { units: [], sourceSnapshots: [] }
  }

  const state: StreamState = {
    chunks: [],
    parts: [],
    barriers: new Set(),
    length: 0,
  }
  collectRawSource(layoutSource, config, state)

  const stream = state.parts.join("")
  const delimiters = findBlankLineDelimiters(stream, state)
  if (delimiters.length === 0) return { units: [], sourceSnapshots: [] }

  const units: VirtualParagraphUnit[] = []
  for (const segment of createRawSegments(stream.length, delimiters)) {
    const rawText = stream.slice(segment.start, segment.end)
    const text = rawText.trim()
    if (text === "") continue

    const contentStart = segment.start + (rawText.length - rawText.trimStart().length)
    const contentEnd = segment.end - (rawText.length - rawText.trimEnd().length)
    const boundary = boundaryAtStreamOffset(state.chunks, segment.insertionIndex, layoutSource)
    const liftedBoundary = liftParagraphInsertionBoundary(boundary, layoutSource, config)

    units.push({
      id: units.length,
      text,
      insertionBoundary: moveParagraphInsertionBoundaryAfterTrailingInlineImages(
        liftedBoundary,
        layoutSource,
      ),
      sourceFragments: createSourceFragments(state.chunks, contentStart, contentEnd),
    })
  }

  return units.length >= 2
    ? { units, sourceSnapshots: createSourceSnapshots(state.chunks) }
    : { units: [], sourceSnapshots: [] }
}

export function buildVirtualParagraphUnits(
  layoutSource: HTMLElement,
  config: Config,
): VirtualParagraphUnit[] {
  return buildVirtualParagraphPlan(layoutSource, config).units
}
