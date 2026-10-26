import type { MockInstance } from "vitest"
// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createNodeTranslationPreview, getOutlineBox } from "../node-translation-preview"

const mocks = vi.hoisted(() => ({
  findNearestAncestorBlockNodeAt: vi.fn<(...args: any[]) => Element | null>(),
}))

vi.mock("@/utils/host/dom/find", () => ({
  findNearestAncestorBlockNodeAt: mocks.findNearestAncestorBlockNodeAt,
}))

const config = { pageTranslation: { node: { enabled: true, hotkey: "control" } } } as Config
const viewport = { width: 1000, height: 800 }

function createBlock(rect: { left: number; top: number; width: number; height: number }) {
  const block = document.createElement("p")
  document.body.append(block)
  const setRect = (next: typeof rect) => {
    vi.spyOn(block, "getBoundingClientRect").mockReturnValue({
      ...next,
      x: next.left,
      y: next.top,
      right: next.left + next.width,
      bottom: next.top + next.height,
      toJSON: () => ({}),
    })
  }
  setRect(rect)
  return { block, setRect }
}

describe("getOutlineBox", () => {
  it("rings the block a few pixels outside its edges", () => {
    expect(getOutlineBox({ left: 100, top: 50, right: 300, bottom: 90 }, viewport)).toEqual({
      left: 96,
      top: 46,
      width: 208,
      height: 48,
    })
  })

  it("keeps the ring on screen around a block that touches the viewport's edges", () => {
    expect(getOutlineBox({ left: 0, top: 2, right: 1000, bottom: 800 }, viewport)).toEqual({
      left: 0,
      top: 0,
      width: 1000,
      height: 800,
    })
  })

  it("lets the edges of a block that runs past the viewport run past it too", () => {
    expect(getOutlineBox({ left: 100, top: -400, right: 600, bottom: 2000 }, viewport)).toEqual({
      left: 96,
      top: -400,
      width: 508,
      height: 2400,
    })
  })
})

describe("createNodeTranslationPreview", () => {
  let frames = new Map<number, FrameRequestCallback>()
  let nextFrameId = 1
  let now = 0
  let attachShadow: MockInstance<HTMLElement["attachShadow"]>
  let preview: ReturnType<typeof createNodeTranslationPreview> | null = null

  const flushFrame = () => {
    const callbacks = [...frames.values()]
    frames = new Map()
    callbacks.forEach((callback) => callback(now))
  }

  const getShadowRoot = () => attachShadow.mock.results[0]?.value as ShadowRoot | undefined
  const getOutline = () => getShadowRoot()?.querySelector<HTMLElement>(".outline") ?? null

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
    vi.spyOn(performance, "now").mockImplementation(() => now)
    // Calls through, and keeps the closed roots it returns for the assertions.
    attachShadow = vi.spyOn(HTMLElement.prototype, "attachShadow")
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(viewport.width)
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(viewport.height)
  })

  afterEach(() => {
    preview?.destroy()
    preview = null
    frames = new Map()
    now = 0
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    mocks.findNearestAncestorBlockNodeAt.mockReset()
  })

  it("rings the block at the point on the next frame, in a closed root under <html>", () => {
    const { block } = createBlock({ left: 100, top: 50, width: 200, height: 40 })
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(block)
    preview = createNodeTranslationPreview()

    preview.show({ x: 150, y: 60 }, config)
    expect(getOutline()).toBeNull()
    flushFrame()

    expect(mocks.findNearestAncestorBlockNodeAt).toHaveBeenCalledWith({ x: 150, y: 60 }, config)
    const outline = getOutline()
    expect(outline?.hasAttribute("data-visible")).toBe(true)
    expect(outline?.hasAttribute("data-glide")).toBe(false)
    expect(outline?.style.transform).toBe("translate(96px, 46px)")
    expect(outline?.style.width).toBe("208px")
    expect(outline?.style.height).toBe("48px")

    expect(getShadowRoot()?.mode).toBe("closed")
    const host = getShadowRoot()?.host as HTMLElement
    expect(host.parentElement).toBe(document.documentElement)
    expect(host.classList.contains("notranslate")).toBe(true)
  })

  it("glides to the next block, and stays on a block that scrolls once the glide is done", () => {
    const paragraph = createBlock({ left: 100, top: 50, width: 200, height: 40 })
    const article = createBlock({ left: 80, top: 20, width: 600, height: 1500 })
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(paragraph.block)
    preview = createNodeTranslationPreview()

    preview.show({ x: 150, y: 60 }, config)
    flushFrame()

    // The pointer moves into the article's margin.
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(article.block)
    preview.show({ x: 90, y: 60 }, config)
    flushFrame()
    const outline = getOutline()
    expect(outline?.hasAttribute("data-glide")).toBe(true)
    expect(outline?.style.transform).toBe("translate(76px, 16px)")

    now = 1000
    article.setRect({ left: 80, top: -100, width: 600, height: 1500 })
    window.dispatchEvent(new Event("scroll"))
    flushFrame()
    expect(outline?.hasAttribute("data-glide")).toBe(false)
    expect(outline?.style.transform).toBe("translate(76px, -100px)")
  })

  it("grows to a block around the ringed one only once the pointer stays there", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const paragraph = createBlock({ left: 100, top: 50, width: 200, height: 40 })
    const article = createBlock({ left: 80, top: 20, width: 600, height: 300 })
    article.block.append(paragraph.block)
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(paragraph.block)
    preview = createNodeTranslationPreview()

    preview.show({ x: 150, y: 60 }, config)
    flushFrame()
    const outline = getOutline()

    // The gap below the paragraph belongs to the article.
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(article.block)
    preview.show({ x: 150, y: 95 }, config)
    flushFrame()
    expect(outline?.style.transform).toBe("translate(96px, 46px)")

    now = 149
    vi.advanceTimersByTime(149)
    flushFrame()
    expect(outline?.style.transform).toBe("translate(96px, 46px)")

    now = 150
    vi.advanceTimersByTime(1)
    flushFrame()
    expect(outline?.style.transform).toBe("translate(76px, 16px)")
    expect(outline?.hasAttribute("data-glide")).toBe(true)

    // Back onto the paragraph: the ring shrinks to it at once.
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(paragraph.block)
    preview.show({ x: 150, y: 60 }, config)
    flushFrame()
    expect(outline?.style.transform).toBe("translate(96px, 46px)")
    vi.useRealTimers()
  })

  it("hands back the block it framed when hidden", () => {
    const { block } = createBlock({ left: 100, top: 50, width: 200, height: 40 })
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(block)
    preview = createNodeTranslationPreview()

    preview.show({ x: 150, y: 60 }, config)
    flushFrame()

    expect(preview.hide()).toBe(block)
    expect(preview.hide()).toBeNull()
  })

  it("does not draw a ring where no block is found", () => {
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(null)
    preview = createNodeTranslationPreview()

    preview.show({ x: 5, y: 5 }, config)
    flushFrame()

    expect(getOutline()).toBeNull()
  })

  it("hides the ring, stops following scrolls, and leaves the page on destroy", () => {
    const { block } = createBlock({ left: 100, top: 50, width: 200, height: 40 })
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(block)
    preview = createNodeTranslationPreview()

    preview.show({ x: 150, y: 60 }, config)
    flushFrame()
    preview.hide()

    const outline = getOutline()
    expect(outline?.hasAttribute("data-visible")).toBe(false)
    mocks.findNearestAncestorBlockNodeAt.mockClear()
    window.dispatchEvent(new Event("scroll"))
    flushFrame()
    expect(mocks.findNearestAncestorBlockNodeAt).not.toHaveBeenCalled()

    const host = getShadowRoot()?.host
    preview.destroy()
    preview = null
    expect(host?.isConnected).toBe(false)
  })
})
