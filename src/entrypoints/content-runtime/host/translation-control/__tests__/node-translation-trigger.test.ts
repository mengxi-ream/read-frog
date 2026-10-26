// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SELECTION_SHORTCUT_CLAIMED_EVENT } from "@/utils/constants/selection"
import { registerNodeTranslationTriggerListeners } from "../node-translation-trigger"

const mocks = vi.hoisted(() => {
  // The block under the pointer, labelled with where it was found.
  const blockAt = (point: { x: number; y: number }) => {
    const block = document.createElement("p")
    block.dataset.point = `${point.x},${point.y}`
    return block
  }
  return {
    blockAt,
    findNearestAncestorBlockNodeAt: vi.fn<(point: { x: number; y: number }) => Element | null>(),
  }
})

vi.mock("@/utils/host/dom/find", () => ({
  findNearestAncestorBlockNodeAt: mocks.findNearestAncestorBlockNodeAt,
}))

const { blockAt } = mocks

function createConfig(
  hotkey: Config["pageTranslation"]["node"]["hotkey"],
  shortcut = "Alt+Q",
): Config {
  return {
    pageTranslation: {
      node: {
        enabled: true,
        hotkey,
        shortcut,
      },
    },
  } as Config
}

function dispatchKeyboardEvent(
  type: "keydown" | "keyup",
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = document,
) {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

// Alt+Q as macOS sends it: Option turns the Q into "œ". The Alt keydown's
// config read settles before Q goes down, as it does for a person typing.
async function pressAltQ(target: EventTarget = document, init: KeyboardEventInit = {}) {
  dispatchKeyboardEvent("keydown", "Alt", { code: "AltLeft", altKey: true }, target)
  await flushMicrotasks()
  return dispatchKeyboardEvent("keydown", "œ", { code: "KeyQ", altKey: true, ...init }, target)
}

function dispatchMouseEvent(
  type: "mousemove" | "mouseover" | "mousedown" | "mouseup",
  init: MouseEventInit,
  target: EventTarget = document,
) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

function createPreview(framedBlock: Element | null = null) {
  return {
    show: vi.fn<(point: { x: number; y: number }, config: Config) => void>(),
    hide: vi.fn<() => Element | null>(() => framedBlock),
  }
}

describe("registerNodeTranslationTriggerListeners", () => {
  let teardown: (() => void) | null = null

  beforeEach(() => {
    mocks.findNearestAncestorBlockNodeAt.mockImplementation((point) => blockAt(point))
  })

  afterEach(() => {
    teardown?.()
    teardown = null
    document.body.innerHTML = ""
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("triggers backtick node translation at the latest mouse position", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const getConfig = vi.fn<(...args: any[]) => any>(() =>
      Promise.resolve(createConfig("backtick")),
    )

    teardown = registerNodeTranslationTriggerListeners({
      getConfig,
      onTrigger,
    })

    dispatchMouseEvent("mousemove", { clientX: 50, clientY: 60 })
    dispatchKeyboardEvent("keydown", "`")
    await vi.waitFor(() => {
      expect(getConfig).toHaveBeenCalledTimes(1)
    })
    dispatchKeyboardEvent("keyup", "`")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        blockAt({ x: 50, y: 60 }),
        expect.objectContaining({
          pageTranslation: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "backtick" }),
          }),
        }),
      )
    })
  })

  it("triggers node translation at the latest mouseover position", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await Promise.resolve()
    dispatchKeyboardEvent("keyup", "Control")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        blockAt({ x: 70, y: 80 }),
        expect.objectContaining({
          pageTranslation: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "control" }),
          }),
        }),
      )
    })
  })

  it("falls back to the hovered element center when no mouse position was recorded", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const hovered = document.createElement("p")
    document.body.append(hovered)
    vi.spyOn(hovered, "getBoundingClientRect").mockReturnValue({
      left: 20,
      top: 30,
      width: 100,
      height: 40,
      right: 120,
      bottom: 70,
      x: 20,
      y: 30,
      toJSON: () => ({}),
    })
    vi.spyOn(document, "querySelectorAll").mockImplementation((selector) => {
      if (selector === ":hover") {
        const hoveredElements = [document.documentElement, document.body, hovered]
        return {
          length: hoveredElements.length,
          item: (index: number) => hoveredElements[index] ?? null,
        } as unknown as NodeListOf<Element>
      }

      return [] as unknown as NodeListOf<Element>
    })

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("backtick")),
      onTrigger,
    })

    dispatchKeyboardEvent("keydown", "`")
    await Promise.resolve()
    dispatchKeyboardEvent("keyup", "`")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        blockAt({ x: 70, y: 50 }),
        expect.objectContaining({
          pageTranslation: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "backtick" }),
          }),
        }),
      )
    })
  })

  it("rings the block on a still long press and translates it on release instead of clicking", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()
    const link = document.createElement("a")
    document.body.append(link)
    const pageClick = vi.fn<(event: MouseEvent) => void>()
    link.addEventListener("click", pageClick)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mousedown", { button: 0, clientX: 30, clientY: 40 }, link)
    await vi.advanceTimersByTimeAsync(500)

    expect(preview.show).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        pageTranslation: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "clickAndHold" }),
        }),
      }),
    )
    expect(onTrigger).not.toHaveBeenCalled()

    dispatchMouseEvent("mouseup", { button: 0, clientX: 30, clientY: 40 }, link)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true })
    link.dispatchEvent(click)

    expect(preview.hide).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledWith(blockAt({ x: 30, y: 40 }), expect.anything())
    expect(click.defaultPrevented).toBe(true)
    expect(pageClick).not.toHaveBeenCalled()

    // Only that one click: the next is the page's again.
    await vi.advanceTimersByTimeAsync(0)
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    expect(pageClick).toHaveBeenCalledTimes(1)
  })

  it("cancels a long press that moves, as selecting text does", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()
    const target = document.createElement("p")
    document.body.append(target)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mousedown", { button: 0, clientX: 30, clientY: 40 }, target)
    await vi.advanceTimersByTimeAsync(500)
    dispatchMouseEvent("mousemove", { clientX: 60, clientY: 40 }, target)
    dispatchMouseEvent("mouseup", { button: 0, clientX: 60, clientY: 40 }, target)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true })
    target.dispatchEvent(click)

    expect(preview.hide).toHaveBeenCalledTimes(1)
    expect(onTrigger).not.toHaveBeenCalled()
    expect(click.defaultPrevented).toBe(false)
  })

  it("does not start a long press after a click that outlasted the config read", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()
    const target = document.createElement("p")
    document.body.append(target)
    let resolveConfig: (config: Config) => void = () => {}

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => new Promise<Config>((resolve) => (resolveConfig = resolve)),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mousedown", { button: 0, clientX: 30, clientY: 40 }, target)
    dispatchMouseEvent("mouseup", { button: 0, clientX: 30, clientY: 40 }, target)
    resolveConfig(createConfig("clickAndHold"))
    await vi.advanceTimersByTimeAsync(1000)

    expect(preview.show).not.toHaveBeenCalled()
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("rings the block while the hotkey is held and translates it once on release", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await Promise.resolve()

    await vi.advanceTimersByTimeAsync(499)
    expect(preview.show).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(preview.show).toHaveBeenCalledWith(
      { x: 70, y: 80 },
      expect.objectContaining({
        pageTranslation: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "control" }),
        }),
      }),
    )
    // Held: nothing is translated yet.
    await vi.advanceTimersByTimeAsync(1000)
    expect(onTrigger).not.toHaveBeenCalled()

    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(preview.hide).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledWith(
      blockAt({ x: 70, y: 80 }),
      expect.objectContaining({
        pageTranslation: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "control" }),
        }),
      }),
    )
  })

  it("moves the ring with the pointer and translates where it last was", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("alt")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mousemove", { clientX: 10, clientY: 10 })
    dispatchKeyboardEvent("keydown", "Alt")
    await vi.advanceTimersByTimeAsync(500)

    // Every move counts while the ring shows, however quick the moves come.
    dispatchMouseEvent("mousemove", { clientX: 40, clientY: 10 })
    dispatchMouseEvent("mousemove", { clientX: 80, clientY: 10 })
    expect(preview.show).toHaveBeenLastCalledWith({ x: 80, y: 10 }, expect.anything())

    dispatchKeyboardEvent("keyup", "Alt")
    await flushMicrotasks()

    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledWith(blockAt({ x: 80, y: 10 }), expect.anything())
  })

  it("translates the block the ring framed, even when the pointer has moved on", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const paragraph = document.createElement("p")
    document.body.append(paragraph)
    const preview = createPreview(paragraph)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await vi.advanceTimersByTimeAsync(500)
    // Into the gap below the paragraph, where the ring waits before growing.
    dispatchMouseEvent("mousemove", { clientX: 70, clientY: 120 })
    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledWith(paragraph, expect.anything())
  })

  it("translates at the pointer when the framed block left the page", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview(document.createElement("p"))

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await vi.advanceTimersByTimeAsync(500)
    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(onTrigger).toHaveBeenCalledWith(blockAt({ x: 70, y: 80 }), expect.anything())
  })

  it("translates nothing where no block is under the pointer", async () => {
    mocks.findNearestAncestorBlockNodeAt.mockReturnValue(null)
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await flushMicrotasks()
    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(mocks.findNearestAncestorBlockNodeAt).toHaveBeenCalledWith(
      { x: 70, y: 80 },
      expect.anything(),
    )
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("translates a tap on release without showing the ring", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("shift")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Shift")
    await vi.advanceTimersByTimeAsync(200)
    dispatchKeyboardEvent("keyup", "Shift")
    await vi.advanceTimersByTimeAsync(500)

    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(preview.show).not.toHaveBeenCalled()
  })

  it("cancels a held hotkey when another key creates a combo", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await vi.advanceTimersByTimeAsync(500)
    expect(preview.show).toHaveBeenCalled()

    dispatchKeyboardEvent("keydown", "a")
    await flushMicrotasks()
    expect(preview.hide).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)
    dispatchKeyboardEvent("keyup", "a")
    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(onTrigger).not.toHaveBeenCalled()
    expect(preview.show).toHaveBeenCalledTimes(1)
  })

  it("cancels the hotkey before the hold delay when another key creates a combo", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(250)

    dispatchKeyboardEvent("keydown", "a")
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(500)
    dispatchKeyboardEvent("keyup", "a")
    dispatchKeyboardEvent("keyup", "Control")
    await Promise.resolve()

    expect(onTrigger).not.toHaveBeenCalled()
    expect(preview.show).not.toHaveBeenCalled()
  })

  it("cancels a held hotkey on a click, as Ctrl+click opens a link", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()
    const link = document.createElement("a")
    document.body.append(link)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Control")
    await vi.advanceTimersByTimeAsync(500)
    dispatchMouseEvent("mousedown", { button: 0, clientX: 70, clientY: 80 }, link)
    dispatchMouseEvent("mouseup", { button: 0, clientX: 70, clientY: 80 }, link)
    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(preview.hide).toHaveBeenCalledTimes(1)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("drops a held hotkey when the window loses focus", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("alt")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Alt")
    await vi.advanceTimersByTimeAsync(500)
    window.dispatchEvent(new FocusEvent("blur"))

    expect(preview.hide).toHaveBeenCalledTimes(1)

    // The release came back late, or went to the other window.
    dispatchKeyboardEvent("keyup", "Alt")
    await flushMicrotasks()
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("translates the first tap after another key was pressed and released", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    // Space scrolls the page first.
    dispatchKeyboardEvent("keydown", " ")
    dispatchKeyboardEvent("keyup", " ")
    await flushMicrotasks()
    dispatchKeyboardEvent("keydown", "Control")
    await flushMicrotasks()
    dispatchKeyboardEvent("keyup", "Control")

    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledTimes(1)
    })
  })

  it("does not translate when the hotkey joins a key that is still held", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("shift")),
      onTrigger,
    })

    // Ctrl+Shift+T, with Shift as the hotkey
    dispatchKeyboardEvent("keydown", "Control", { ctrlKey: true })
    await flushMicrotasks()
    dispatchKeyboardEvent("keydown", "Shift", { ctrlKey: true, shiftKey: true })
    await flushMicrotasks()
    dispatchKeyboardEvent("keyup", "Shift", { ctrlKey: true })
    dispatchKeyboardEvent("keyup", "Control")
    await flushMicrotasks()

    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("cancels the hotkey when a selection shortcut takes a key the hotkey never sees", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("alt")),
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    dispatchKeyboardEvent("keydown", "Alt")
    await Promise.resolve()
    // Alt+T ran selection translation; its "T" keydown never reached the document.
    window.dispatchEvent(new Event(SELECTION_SHORTCUT_CLAIMED_EVENT))
    await vi.advanceTimersByTimeAsync(500)
    dispatchKeyboardEvent("keyup", "Alt")
    await Promise.resolve()

    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("does not trigger while the caller says the event should be ignored", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
      shouldIgnoreEvent: () => true,
    })

    dispatchMouseEvent("mousemove", { clientX: 50, clientY: 60 })
    dispatchKeyboardEvent("keydown", "Control")
    await Promise.resolve()
    dispatchKeyboardEvent("keyup", "Control")
    await Promise.resolve()

    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("translates the hovered paragraph when the custom shortcut is let go, and keeps the keys from the page", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const pageListener = vi.fn<(event: KeyboardEvent) => void>()
    window.addEventListener("keydown", pageListener)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("custom")),
      onTrigger,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    const keyQ = await pressAltQ()
    await flushMicrotasks()
    expect(onTrigger).not.toHaveBeenCalled()

    // Q comes up first, still with Option down, so as "œ" again.
    dispatchKeyboardEvent("keyup", "œ", { code: "KeyQ", altKey: true })
    await vi.waitFor(() => {
      expect(onTrigger).toHaveBeenCalledWith(
        blockAt({ x: 70, y: 80 }),
        expect.objectContaining({
          pageTranslation: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "custom" }),
          }),
        }),
      )
    })
    expect(keyQ.defaultPrevented).toBe(true)
    expect(pageListener.mock.calls.map(([event]) => event)).not.toContain(keyQ)
    window.removeEventListener("keydown", pageListener)
  })

  it("rings the block while the custom shortcut is held and translates it once when any of its keys comes up", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("custom")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    await pressAltQ()
    const repeats = [1, 2, 3].map(() =>
      dispatchKeyboardEvent("keydown", "œ", { code: "KeyQ", altKey: true, repeat: true }),
    )
    await vi.advanceTimersByTimeAsync(500)

    expect(repeats.every((event) => event.defaultPrevented)).toBe(true)
    expect(preview.show).toHaveBeenCalledWith({ x: 70, y: 80 }, expect.anything())
    expect(onTrigger).not.toHaveBeenCalled()

    // Option first, then Q.
    dispatchKeyboardEvent("keyup", "Alt", { code: "AltLeft" })
    await flushMicrotasks()
    dispatchKeyboardEvent("keyup", "q", { code: "KeyQ" })
    await flushMicrotasks()

    expect(preview.hide).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it("cancels a held custom shortcut when another key joins it", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const preview = createPreview()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("custom")),
      onTrigger,
      preview,
    })

    dispatchMouseEvent("mouseover", { clientX: 70, clientY: 80 })
    await pressAltQ()
    await vi.advanceTimersByTimeAsync(500)
    dispatchKeyboardEvent("keydown", "Escape", { code: "Escape", altKey: true })
    await flushMicrotasks()
    expect(preview.hide).toHaveBeenCalledTimes(1)

    dispatchKeyboardEvent("keyup", "Escape", { code: "Escape", altKey: true })
    dispatchKeyboardEvent("keyup", "œ", { code: "KeyQ", altKey: true })
    dispatchKeyboardEvent("keyup", "Alt", { code: "AltLeft" })
    await flushMicrotasks()

    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("leaves other keys alone while the custom shortcut is chosen", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("custom", "Control+Q")),
      onTrigger,
    })

    // Its modifier tapped or held alone, as the single-key hotkeys are.
    dispatchKeyboardEvent("keydown", "Control", { ctrlKey: true })
    await vi.advanceTimersByTimeAsync(500)
    dispatchKeyboardEvent("keyup", "Control")
    // Another combination with the same modifier.
    const copy = dispatchKeyboardEvent("keydown", "c", { code: "KeyC", ctrlKey: true })
    await vi.advanceTimersByTimeAsync(500)

    expect(onTrigger).not.toHaveBeenCalled()
    expect(copy.defaultPrevented).toBe(false)
  })

  it("does not listen for the custom shortcut while another hotkey is chosen", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("control")),
      onTrigger,
    })

    const keyQ = await pressAltQ()
    await vi.advanceTimersByTimeAsync(500)

    expect(onTrigger).not.toHaveBeenCalled()
    expect(keyQ.defaultPrevented).toBe(false)
  })

  it("lets the custom shortcut through to a field, also one inside a shadow root", async () => {
    const onTrigger = vi.fn<(...args: any[]) => any>()
    const host = document.createElement("div")
    document.body.append(host)
    const field = document.createElement("input")
    host.attachShadow({ mode: "open" }).append(field)

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("custom")),
      onTrigger,
    })

    const keyQ = await pressAltQ(field, { composed: true })
    await flushMicrotasks()

    expect(onTrigger).not.toHaveBeenCalled()
    expect(keyQ.defaultPrevented).toBe(false)
  })

  it("does not start click-and-hold translation from document surface targets", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn<(...args: any[]) => any>()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
    })

    dispatchMouseEvent("mousedown", { button: 0, clientX: 900, clientY: 100 }, document.body)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(500)

    dispatchMouseEvent(
      "mousedown",
      { button: 0, clientX: 900, clientY: 100 },
      document.documentElement,
    )
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(500)

    expect(onTrigger).not.toHaveBeenCalled()
  })
})
