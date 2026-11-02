import {
  ANNOTATION_LEADING_ATTRIBUTE,
  GLOSS_GAP_PX,
  GLOSS_LINE_PX,
  LEADING_LADDER_MAX,
  LEADING_LADDER_MIN,
  UNDERLINE_OFFSET_PX,
} from "./styles"
import { firstTextNode } from "./text-offsets"

// Making room between the lines. A gloss sits in the gap under a line, and
// the gap is the used line-height minus the height of the glyph box, NOT
// `line-height - font-size`: `line-height: normal` leaves no gap at all for
// most system fonts. Measured on a short range of plain text rather than the
// whole block, because a superscript or an inline image in the block would
// inflate the box.

/** What a gloss needs under a line: its line box, the gap, and the underline's own offset. */
export const REQUIRED_GAP_PX = GLOSS_LINE_PX + GLOSS_GAP_PX + UNDERLINE_OFFSET_PX + 1

const PROBE_LENGTH = 24

export interface LeadingMeasurement {
  fontSize: number
  /** The used line-height in px, or `null` for `normal`, which leaves no gap. */
  lineHeight: number | null
  inkHeight: number
}

/** The gap a line leaves under its glyphs, in px. */
export function gapOf(measurement: LeadingMeasurement): number {
  if (measurement.lineHeight === null) return 0
  return Math.max(0, measurement.lineHeight - measurement.inkHeight)
}

/**
 * The ladder rung (tenths of the font size) that makes room for a gloss, or
 * `null` when the line already has it. Rounded up to the rung above, and
 * never past the ladder's ends.
 */
export function leadingRungFor(measurement: LeadingMeasurement): number | null {
  if (gapOf(measurement) >= REQUIRED_GAP_PX) return null
  if (measurement.fontSize <= 0) return null
  const needed = measurement.inkHeight + REQUIRED_GAP_PX
  const rung = Math.ceil((needed / measurement.fontSize) * 10)
  return Math.min(LEADING_LADDER_MAX, Math.max(LEADING_LADDER_MIN, rung))
}

/**
 * Measures the line the probe text sits on. `probe` is the annotated text's
 * own node when there is one, so an inline element with its own font is
 * measured as itself.
 */
export function measureLeading(block: Element, probe: Text | null): LeadingMeasurement | null {
  const textNode = probe ?? firstTextNode(block)
  const element = textNode?.parentElement ?? block
  const style = getComputedStyle(element)
  const fontSize = Number.parseFloat(style.fontSize)
  if (!Number.isFinite(fontSize) || fontSize <= 0) return null
  const lineHeight = style.lineHeight === "normal" ? null : Number.parseFloat(style.lineHeight)

  let inkHeight = fontSize * 1.15
  if (textNode) {
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(textNode.length, PROBE_LENGTH))
    // One line's glyph box. The probe can wrap — a balanced heading, a narrow
    // column — and its bounding rect would then be two lines tall, asking for
    // twice the leading a gloss needs.
    const line = Array.from(range.getClientRects()).find((rect) => rect.height > 0)
    if (line) inkHeight = line.height
  }

  return {
    fontSize,
    lineHeight: lineHeight !== null && Number.isFinite(lineHeight) ? lineHeight : null,
    inkHeight,
  }
}

/**
 * The element whose line-height the probe's line uses: the block, unless an
 * inline ancestor of the text declares its own. Bumping the block then does
 * nothing, so the rung goes on the ancestor.
 */
export function findLineHeightOwner(block: Element, probe: Text | null): Element {
  const blockLineHeight = getComputedStyle(block).lineHeight
  let element = probe?.parentElement ?? null
  while (element && element !== block) {
    if (getComputedStyle(element).lineHeight !== blockLineHeight) return element
    element = element.parentElement
  }
  return block
}

const CLIP_CHECK_DEPTH = 8

/**
 * Whether taller lines would be clipped or misplaced: a fixed box that hides
 * its overflow, a line clamp, vertical text, an editor. Then the block gets
 * marks but no glosses.
 */
export function isLeadingUnsafe(block: Element): boolean {
  const blockStyle = getComputedStyle(block)
  if (blockStyle.writingMode !== "horizontal-tb") return true
  if (Number.parseFloat(blockStyle.fontSize) < 11) return true
  if (block instanceof HTMLElement && block.isContentEditable) return true

  let element: Element | null = block
  for (let depth = 0; element && depth < CLIP_CHECK_DEPTH; depth += 1) {
    const style = getComputedStyle(element)
    const lineClamp = style.getPropertyValue("-webkit-line-clamp")
    if (lineClamp !== "" && lineClamp !== "none") return true
    if (style.position === "fixed") return true
    const overflowY = style.overflowY
    if (
      (overflowY === "hidden" || overflowY === "clip") &&
      (style.maxHeight !== "none" || element.scrollHeight > element.clientHeight + 1)
    ) {
      return true
    }
    element = element.parentElement
  }
  return false
}

/**
 * Whether a box around the block now cuts part of it off. A fixed `height`
 * with hidden overflow does not show in the computed style (that is always
 * px), so it is caught after a rung is applied: content that fitted before
 * and overflows now was pushed out by the rung.
 */
export function isLeadingClipped(block: Element): boolean {
  let element: Element | null = block
  for (let depth = 0; element && depth < CLIP_CHECK_DEPTH; depth += 1) {
    const { overflowY } = getComputedStyle(element)
    if (
      (overflowY === "hidden" || overflowY === "clip") &&
      element.scrollHeight > element.clientHeight + 1
    ) {
      return true
    }
    element = element.parentElement
  }
  return false
}

export function applyLeadingRung(element: Element, rung: number): void {
  element.setAttribute(ANNOTATION_LEADING_ATTRIBUTE, String(rung))
}

export function clearLeadingRung(element: Element): void {
  element.removeAttribute(ANNOTATION_LEADING_ATTRIBUTE)
}
