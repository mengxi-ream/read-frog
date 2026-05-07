// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { registerNodeTranslationTriggerListeners } from "../node-translation-trigger"

function createConfig(hotkey: Config["translate"]["node"]["hotkey"]): Config {
  return {
    translate: {
      node: {
        enabled: true,
        hotkey,
      },
    },
  } as Config
}

function dispatchKeyboardEvent(type: "keydown" | "keyup", key: string) {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))
}

function dispatchMouseEvent(type: "mousemove" | "mouseover" | "mousedown" | "mouseup", init: MouseEventInit) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

describe("registerNodeTranslationTriggerListeners", () => {
  let teardown: (() => void) | null = null

  afterEach(() => {
    teardown?.()
    teardown = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("triggers backtick node translation at the latest mouse position", async () => {
    const onTrigger = vi.fn()
    const getConfig = vi.fn(() => Promise.resolve(createConfig("backtick")))

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
        { x: 50, y: 60 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "backtick" }),
          }),
        }),
      )
    })
  })

  it("triggers node translation at the latest mouseover position", async () => {
    const onTrigger = vi.fn()

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
        { x: 70, y: 80 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "control" }),
          }),
        }),
      )
    })
  })

  it("falls back to the hovered element center when no mouse position was recorded", async () => {
    const onTrigger = vi.fn()
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
    } as DOMRect)
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
        { x: 70, y: 50 },
        expect.objectContaining({
          translate: expect.objectContaining({
            node: expect.objectContaining({ hotkey: "backtick" }),
          }),
        }),
      )
    })
  })

  it("triggers click-and-hold node translation after the hold delay", async () => {
    vi.useFakeTimers()
    const onTrigger = vi.fn()

    teardown = registerNodeTranslationTriggerListeners({
      getConfig: () => Promise.resolve(createConfig("clickAndHold")),
      onTrigger,
    })

    dispatchMouseEvent("mousedown", { button: 0, clientX: 30, clientY: 40 })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)

    expect(onTrigger).toHaveBeenCalledWith(
      { x: 30, y: 40 },
      expect.objectContaining({
        translate: expect.objectContaining({
          node: expect.objectContaining({ hotkey: "clickAndHold" }),
        }),
      }),
    )
  })

  it("does not trigger while the caller says the event should be ignored", async () => {
    const onTrigger = vi.fn()

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
})
