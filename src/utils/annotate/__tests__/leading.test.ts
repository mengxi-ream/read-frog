// @vitest-environment jsdom
import type { LeadingMeasurement } from "../leading"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  gapOf,
  isLeadingUnsafe,
  isTooSmallForGloss,
  leadingRungFor,
  measureLeading,
  MIN_GLOSSED_FONT_PX,
  REQUIRED_GAP_PX,
} from "../leading"
import { LEADING_LADDER_MAX, LEADING_LADDER_MIN } from "../styles"

describe("leadingRungFor", () => {
  it("leaves a line alone when the gap under it already fits a gloss", () => {
    const measurement = {
      fontSize: 16,
      lineHeight: 16 * 1.15 + REQUIRED_GAP_PX,
      inkHeight: 16 * 1.15,
    }
    expect(gapOf(measurement)).toBeCloseTo(REQUIRED_GAP_PX)
    expect(leadingRungFor(measurement)).toBeNull()
  })

  it("treats line-height: normal as leaving no gap", () => {
    expect(gapOf({ fontSize: 16, lineHeight: null, inkHeight: 18 })).toBe(0)
  })

  it("rounds the needed line-height up to the rung above", () => {
    // (18 + 18) / 16 = 2.25 → 2.3
    const rung = leadingRungFor({ fontSize: 16, lineHeight: 24, inkHeight: 18 })
    expect(rung).toBe(Math.ceil(((18 + REQUIRED_GAP_PX) / 16) * 10))
  })

  it("never leaves the ladder", () => {
    expect(leadingRungFor({ fontSize: 100, lineHeight: 100, inkHeight: 100 })).toBe(
      LEADING_LADDER_MIN,
    )
    expect(leadingRungFor({ fontSize: 11, lineHeight: 11, inkHeight: 40 })).toBe(LEADING_LADDER_MAX)
    expect(leadingRungFor({ fontSize: 0, lineHeight: 0, inkHeight: 10 })).toBeNull()
  })
})

// jsdom lays nothing out: the styles and box heights a browser would compute
// are given per element, over a browser's defaults.
type ComputedOverrides = Partial<
  Record<
    "writingMode" | "position" | "overflowY" | "maxHeight" | "fontSize" | "-webkit-line-clamp",
    string
  >
>

function stubComputedStyles(styles: Map<Element, ComputedOverrides>) {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const values: Record<string, string> = {
      writingMode: "horizontal-tb",
      position: "static",
      overflowY: "visible",
      maxHeight: "none",
      fontSize: "16px",
      lineHeight: "normal",
      "-webkit-line-clamp": "none",
      ...styles.get(element),
    }
    return {
      ...values,
      getPropertyValue: (name: string) => values[name] ?? "",
    } as unknown as CSSStyleDeclaration
  })
}

function setBoxHeights(element: Element, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight })
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight })
}

/** A YouTube comment as measured there: a clamped 10px box, the text in a span of its own size. */
function comment(text: string) {
  const block = document.createElement("div")
  const span = document.createElement("span")
  span.textContent = text
  block.append(span)
  document.body.append(block)
  return { block, span }
}

const CLAMPED_BOX: ComputedOverrides = {
  "-webkit-line-clamp": "4",
  overflowY: "hidden",
  fontSize: "10px",
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe("isLeadingUnsafe", () => {
  it("lets a line clamp that cuts nothing off make room", () => {
    const { block } = comment("Anyone from 2026?")
    setBoxHeights(block, 20, 20)
    stubComputedStyles(new Map([[block, CLAMPED_BOX]]))

    expect(isLeadingUnsafe(block)).toBe(false)
  })

  it("keeps a line clamp that already cuts text off to marks only", () => {
    const { block } = comment("A long comment that runs past its fourth line…")
    setBoxHeights(block, 160, 80)
    stubComputedStyles(new Map([[block, CLAMPED_BOX]]))

    expect(isLeadingUnsafe(block)).toBe(true)
  })

  it("finds a clamp that cuts text off on an ancestor of the block", () => {
    const { block } = comment("Anyone from 2026?")
    const card = document.createElement("div")
    card.append(block)
    document.body.append(card)
    setBoxHeights(block, 20, 20)
    setBoxHeights(card, 160, 80)
    stubComputedStyles(new Map([[card, CLAMPED_BOX]]))

    expect(isLeadingUnsafe(block)).toBe(true)
  })

  it("still refuses a box with a max height that hides its overflow", () => {
    const { block } = comment("Anyone from 2026?")
    setBoxHeights(block, 20, 20)
    stubComputedStyles(new Map([[block, { overflowY: "hidden", maxHeight: "200px" }]]))

    expect(isLeadingUnsafe(block)).toBe(true)
  })
})

describe("text too small for a gloss", () => {
  const measured = (fontSize: number): LeadingMeasurement => ({
    fontSize,
    lineHeight: null,
    inkHeight: fontSize * 1.15,
  })

  it("draws the line at the minimum size", () => {
    expect(isTooSmallForGloss(measured(MIN_GLOSSED_FONT_PX - 1))).toBe(true)
    expect(isTooSmallForGloss(measured(MIN_GLOSSED_FONT_PX))).toBe(false)
  })

  it("is the text's own size, not its block's", () => {
    const { block, span } = comment("Anyone from 2026?")
    stubComputedStyles(
      new Map([
        [block, CLAMPED_BOX],
        [span, { fontSize: "14px" }],
      ]),
    )
    // jsdom has no line boxes, nor Range#getClientRects: with no rects the
    // measurement falls back to the font size.
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [],
    })
    try {
      const measurement = measureLeading(block, span.firstChild as Text)
      expect(measurement?.fontSize).toBe(14)
      expect(isTooSmallForGloss(measurement!)).toBe(false)
    } finally {
      Reflect.deleteProperty(Range.prototype, "getClientRects")
    }
  })
})
