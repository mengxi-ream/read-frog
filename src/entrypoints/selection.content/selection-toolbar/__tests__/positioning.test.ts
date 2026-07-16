// @vitest-environment jsdom
import type { SelectionRangeSnapshot } from "../../utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  collectSelectionScrollTargets,
  collectSelectionShadowRoots,
  createSelectionAnchorTracker,
  getSelectionDirection,
  getToolbarViewportPosition,
  getViewportRect,
  measureSelectionAnchor,
  SelectionDirection,
  viewportPointToHostPoint,
} from "../positioning"

function createRect({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}) {
  return {
    x: left,
    y: top,
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

const viewport = {
  top: 0,
  right: 1200,
  bottom: 800,
  left: 0,
  width: 1200,
  height: 800,
}

describe("selection toolbar positioning", () => {
  let rangeRects: DOMRect[]
  let rangeInvalid: boolean
  let rangeSnapshot: SelectionRangeSnapshot
  let visualViewportDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    document.body.textContent = "Selected text"
    const textNode = document.body.firstChild as Text
    rangeSnapshot = {
      startContainer: textNode,
      startOffset: 0,
      endContainer: textNode,
      endOffset: textNode.length,
    }
    rangeRects = [createRect({ left: 100, top: 100, width: 120, height: 24 })]
    rangeInvalid = false
    visualViewportDescriptor = Object.getOwnPropertyDescriptor(window, "visualViewport")

    vi.spyOn(document, "createRange").mockImplementation(
      () =>
        ({
          setStart: () => {
            if (rangeInvalid) throw new Error("detached range")
          },
          setEnd: () => {
            if (rangeInvalid) throw new Error("detached range")
          },
          getClientRects: () => {
            if (rangeInvalid) throw new Error("detached range")
            return rangeRects as unknown as DOMRectList
          },
          getBoundingClientRect: () =>
            rangeRects[0] ?? createRect({ left: 0, top: 0, width: 0, height: 0 }),
        }) as unknown as Range,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (visualViewportDescriptor) {
      Object.defineProperty(window, "visualViewport", visualViewportDescriptor)
    } else {
      Reflect.deleteProperty(window, "visualViewport")
    }
  })

  it("reads visual viewport offsets and dimensions", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        offsetLeft: 12,
        offsetTop: 34,
        width: 900,
        height: 600,
      }),
    })

    expect(getViewportRect()).toEqual({
      top: 34,
      right: 912,
      bottom: 634,
      left: 12,
      width: 900,
      height: 600,
    })
  })

  it.each([
    [100, 100, 200, 200, SelectionDirection.BOTTOM_RIGHT],
    [200, 100, 100, 200, SelectionDirection.BOTTOM_LEFT],
    [100, 200, 200, 100, SelectionDirection.TOP_RIGHT],
    [200, 200, 100, 100, SelectionDirection.TOP_LEFT],
  ])("detects all selection directions", (startX, startY, endX, endY, direction) => {
    expect(getSelectionDirection(startX, startY, endX, endY)).toBe(direction)
  })

  it("positions and clamps a toolbar inside the viewport", () => {
    expect(
      getToolbarViewportPosition(
        SelectionDirection.BOTTOM_RIGHT,
        { x: 1190, y: 790 },
        { width: 200, height: 50 },
        viewport,
        25,
      ),
    ).toEqual({ x: 975, y: 725 })
  })

  it("converts viewport coordinates through a translated and scaled host", () => {
    const host = {
      offsetWidth: 1200,
      offsetHeight: 800,
      getBoundingClientRect: () => createRect({ left: -100, top: -200, width: 600, height: 400 }),
    }

    expect(viewportPointToHostPoint({ x: 200, y: 100 }, host)).toEqual({ x: 600, y: 600 })
  })

  it("keeps the pointer offset while the selected range moves", () => {
    const tracker = createSelectionAnchorTracker([rangeSnapshot], { x: 210, y: 124 })
    expect(tracker).not.toBeNull()

    rangeRects = [createRect({ left: 100, top: 40, width: 120, height: 24 })]
    const measurement = measureSelectionAnchor(tracker!, viewport)

    expect(measurement).toMatchObject({
      status: "visible",
      anchor: { x: 210, y: 64 },
    })
  })

  it("falls back to the nearest visible rect when wrapping changes", () => {
    rangeRects = [
      createRect({ left: 100, top: 100, width: 120, height: 24 }),
      createRect({ left: 100, top: 130, width: 80, height: 24 }),
    ]
    const tracker = createSelectionAnchorTracker([rangeSnapshot], { x: 175, y: 150 })
    expect(tracker?.reference.rectIndex).toBe(1)

    rangeRects = [createRect({ left: 100, top: 80, width: 160, height: 24 })]
    const measurement = measureSelectionAnchor(tracker!, viewport)

    expect(measurement).toMatchObject({
      status: "visible",
      tracker: { reference: { rectIndex: 0 } },
    })
  })

  it("reports when the selection is completely outside the viewport", () => {
    const tracker = createSelectionAnchorTracker([rangeSnapshot], { x: 210, y: 124 })
    rangeRects = [createRect({ left: 100, top: -100, width: 120, height: 24 })]

    expect(measureSelectionAnchor(tracker!, viewport)).toEqual({ status: "offscreen" })
  })

  it("reports invalid detached ranges", () => {
    const tracker = createSelectionAnchorTracker([rangeSnapshot], { x: 210, y: 124 })
    rangeInvalid = true

    expect(measureSelectionAnchor(tracker!, viewport)).toEqual({ status: "invalid" })
  })

  it("reports invalid ranges when their boundary nodes are removed", () => {
    const tracker = createSelectionAnchorTracker([rangeSnapshot], { x: 210, y: 124 })
    document.body.textContent = ""

    expect(measureSelectionAnchor(tracker!, viewport)).toEqual({ status: "invalid" })
  })

  it("collects every nested shadow root containing the selection", () => {
    vi.restoreAllMocks()
    document.body.textContent = ""
    const outerHost = document.createElement("div")
    const outerRoot = outerHost.attachShadow({ mode: "open" })
    const innerHost = document.createElement("div")
    const innerRoot = innerHost.attachShadow({ mode: "open" })
    const textNode = document.createTextNode("Shadow selection")
    innerRoot.append(textNode)
    outerRoot.append(innerHost)
    document.body.append(outerHost)

    const roots = collectSelectionShadowRoots([
      {
        startContainer: textNode,
        startOffset: 0,
        endContainer: textNode,
        endOffset: textNode.length,
      },
    ])

    expect(roots).toEqual([innerRoot, outerRoot])
  })

  it("collects the complete ancestor chain as direct scroll targets", () => {
    vi.restoreAllMocks()
    document.body.textContent = ""
    const scroller = document.createElement("div")
    const paragraph = document.createElement("p")
    const textNode = document.createTextNode("Nested selection")
    paragraph.append(textNode)
    scroller.append(paragraph)
    document.body.append(scroller)

    const targets = collectSelectionScrollTargets([
      {
        startContainer: textNode,
        startOffset: 0,
        endContainer: textNode,
        endOffset: textNode.length,
      },
    ])

    expect(targets).toEqual([paragraph, scroller, document.body, document.documentElement])
  })
})
