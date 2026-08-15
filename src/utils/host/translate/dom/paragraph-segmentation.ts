import type { VirtualParagraphSourceSnapshot } from "../core/translation-state"
import type { Config } from "@/types/config/config"
import {
  isBlockTransNode,
  isDontWalkIntoAndDontTranslateAsChildElement,
  isDontWalkIntoButTranslateAsChildElement,
  isHTMLElement,
  isTextNode,
  isTranslatedContentNode,
  isTranslatedWrapperNode,
} from "../../dom/filter"

const PRESERVED_NEWLINE_WHITE_SPACE = new Set(["pre", "pre-wrap", "pre-line", "break-spaces"])

/**
 * True when the element's computed white-space renders literal newlines, i.e.
 * blank lines in its text are real paragraph boundaries (the precondition for
 * buildVirtualParagraphPlan).
 */
export function isNewlinePreservingElement(element: HTMLElement): boolean {
  const whiteSpace = window.getComputedStyle(element).whiteSpace.trim().toLowerCase()
  return PRESERVED_NEWLINE_WHITE_SPACE.has(whiteSpace)
}

/**
 * Giant-paragraph split guard (#1881): splitting a giant paragraph into its
 * descendant paragraph units is only sound when those units are block
 * elements. In a newline-preserving flow container — an X note tweet is a
 * pre-wrap div whose rich-text runs are sibling inline <span>s, each labeled
 * a paragraph (reported on
 * https://x.com/davidjpark96/status/1789773192435060737, a 22k-char note
 * whose bold headings are their own spans) — the inline descendants are
 * segments of ONE text flow.
 * Observing them individually translates each segment as a single blob whose
 * wrapper lands at the segment's end, destroying the blank-line paragraph
 * structure. Such containers must be observed whole so the virtual-paragraph
 * plan provides the split instead.
 *
 * The refusal is deliberately limited to the ALL-inline shape, judged by the
 * same effective (post-site-rule) block marker the translation walker splits
 * on: only then does observing the container whole guarantee the walker takes
 * the single-node path where the virtual-paragraph plan runs. With any block
 * descendant present the walker would take the per-child branch instead —
 * refusing the split there would lose viewport gating without gaining the
 * container-level plan.
 *
 * The refusal is also conditioned on the plan actually segmenting the
 * container: a newline-preserving giant with only single-newline lines and
 * no blank-line delimiters (long pre-wrapped log/code views) yields an EMPTY
 * plan, and observing it whole would translate the entire giant as ONE
 * request — losing viewport gating and risking provider length limits.
 * The same plan builder the translate path uses makes the decision, so the
 * observation-time judgment cannot drift from translate-time behavior.
 */
export function canSplitParagraphIntoDescendants(
  element: HTMLElement,
  descendantParagraphs: readonly HTMLElement[],
  config: Config,
): boolean {
  if (!isNewlinePreservingElement(element)) return true
  if (descendantParagraphs.some((paragraph) => isBlockTransNode(paragraph))) return true
  return buildVirtualParagraphPlan(element, config).units.length < 2
}

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
    if (chunks[index]!.streamEnd <= streamOffset) {
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

      if (isHorizontalWhitespaceText(child!)) {
        if (sawInlineImage) {
          committedBoundary = { container, offset: index + 1 }
        }
        index += 1
        continue
      }

      if (!isVisibleInlineImageWithAlt(child!)) {
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
  if (!isNewlinePreservingElement(layoutSource)) {
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

/**
 * Where one unit's text starts and ends among the layout source's own children.
 * `startOffset` / `endOffset` are non-null only when the edge falls strictly
 * inside a top-level Text node, i.e. exactly where a `splitText` is needed to
 * turn the unit into whole nodes.
 */
export interface VirtualParagraphUnitEdges {
  unit: VirtualParagraphUnit
  startNode: ChildNode
  startOffset: number | null
  endNode: ChildNode
  endOffset: number | null
}

function boundaryBeforeNode(node: Node): DOMBoundary | undefined {
  const parent = node.parentNode
  if (!parent) return undefined
  const index = [...parent.childNodes].indexOf(node as ChildNode)
  if (index === -1) return undefined
  return { container: parent, offset: index }
}

function fragmentEdgeBoundaries(
  fragment: VirtualParagraphSourceFragment,
): { start: DOMBoundary; end: DOMBoundary } | undefined {
  if (isTextNode(fragment.source)) {
    return {
      start: { container: fragment.source, offset: fragment.startOffset },
      end: { container: fragment.source, offset: fragment.endOffset },
    }
  }
  // An atomic element (a preserve-text mention, <code>, <time>) contributes its
  // whole text, so the unit's edge sits beside the element rather than inside it.
  const start = boundaryBeforeNode(fragment.source)
  const end = boundaryAfterElement(fragment.source)
  return start && end ? { start, end } : undefined
}

/**
 * An element the raw-source collector treats as a barrier contributes no text,
 * so a unit whose node range contains one would ship that element's markup to
 * the provider and depend on it echoing the tag back for alignment. Refusing
 * such units keeps them on the pre-existing whole-run path.
 */
function contributesNoText(node: ChildNode, config: Config): boolean {
  return (
    isHTMLElement(node) &&
    (isTranslatedWrapperNode(node) ||
      isTranslatedContentNode(node) ||
      isDontWalkIntoAndDontTranslateAsChildElement(node, config))
  )
}

function unitRangeNodes(
  startNode: ChildNode,
  endNode: ChildNode,
  config: Config,
): ChildNode[] | null {
  const nodes: ChildNode[] = []
  let current: ChildNode | null = startNode
  while (current) {
    if (contributesNoText(current, config)) return null
    nodes.push(current)
    if (current === endNode) return nodes
    current = current.nextSibling
  }
  // endNode is not a following sibling of startNode: the unit does not map onto
  // one contiguous run of children.
  return null
}

/**
 * Resolve every unit of `plan` onto whole children of `layoutSource`, or return
 * `null` when even one unit cannot be expressed that way.
 *
 * A unit is resolvable when both of its content edges, after the usual edge
 * lifting, land either between two children or strictly inside a top-level Text
 * node (which a `splitText` can cut). An edge stuck inside a nested element is
 * not: X puts tweet text in inline `<span>`s, so a note tweet's blank lines sit
 * *inside* a span, and cutting the unit out would mean splitting that element
 * and its styling apart. Those containers keep the pre-existing behavior.
 *
 * This is the single decision both the observation gate and the translate path
 * consult, so what the observer refuses to split is exactly what the translate
 * path can segment — the invariant `canSplitParagraphIntoDescendants` documents.
 */
export function resolveVirtualParagraphUnitEdges(
  layoutSource: HTMLElement,
  plan: VirtualParagraphPlan,
  config: Config,
): VirtualParagraphUnitEdges[] | null {
  if (plan.units.length < 2) return null

  const resolved: VirtualParagraphUnitEdges[] = []
  for (const unit of plan.units) {
    const firstFragment = unit.sourceFragments[0]
    const lastFragment = unit.sourceFragments.at(-1)
    if (!firstFragment || !lastFragment) return null

    const startBoundaries = fragmentEdgeBoundaries(firstFragment)
    const endBoundaries = fragmentEdgeBoundaries(lastFragment)
    if (!startBoundaries || !endBoundaries) return null

    const start = liftEdgeBoundary(startBoundaries.start, layoutSource)
    const end = liftEdgeBoundary(endBoundaries.end, layoutSource)

    // Concrete node references, captured before any split: a later split only
    // inserts siblings, so a captured node stays valid while a child index
    // would silently shift.
    const startNode =
      start.container === layoutSource
        ? (layoutSource.childNodes[start.offset] ?? null)
        : isTextNode(start.container) && start.container.parentNode === layoutSource
          ? start.container
          : null
    const endNode =
      end.container === layoutSource
        ? (layoutSource.childNodes[end.offset - 1] ?? null)
        : isTextNode(end.container) && end.container.parentNode === layoutSource
          ? end.container
          : null
    if (!startNode || !endNode) return null

    const nodes = unitRangeNodes(startNode, endNode, config)
    if (!nodes || nodes.length === 0) return null

    resolved.push({
      unit,
      startNode,
      // Edge lifting already pulled offset 0 and end-of-node offsets out to the
      // parent, so a surviving Text container always needs a real cut.
      startOffset: start.container === startNode ? start.offset : null,
      endNode,
      endOffset: end.container === endNode ? end.offset : null,
    })
  }

  return resolved
}

/**
 * True when every unit of `plan` maps onto whole children of `layoutSource`.
 * See `resolveVirtualParagraphUnitEdges` for what that requires.
 */
export function canMaterializeVirtualParagraphUnits(
  layoutSource: HTMLElement,
  plan: VirtualParagraphPlan,
  config: Config,
): boolean {
  return resolveVirtualParagraphUnitEdges(layoutSource, plan, config) !== null
}
