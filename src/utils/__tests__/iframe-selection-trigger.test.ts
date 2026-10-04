// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEFERRED_SELECTION_OPEN_EVENT,
  SELECTION_TOOLBAR_READY_EVENT,
} from "../constants/selection"
import { registerIframeSelectionTrigger } from "../iframe-selection-trigger"

describe("iframe selection trigger", () => {
  let cleanup: () => void
  let gesture: (event: MouseEvent) => void
  let requestRuntime: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  let resolveRequest: (allowed: boolean) => void
  let open: ReturnType<typeof vi.fn<(event: Event) => void>>

  function select(text: string) {
    document.body.innerHTML = `<p>${text}</p>`
    const range = document.createRange()
    range.selectNodeContents(document.querySelector("p")!)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }
  function trustedGesture() {
    gesture({ type: "mouseup", isTrusted: true, clientX: 80, clientY: 120 } as MouseEvent)
  }
  function ready() {
    window.__READ_FROG_SELECTION_TOOLBAR_READY__ = true
    window.dispatchEvent(new CustomEvent(SELECTION_TOOLBAR_READY_EVENT))
  }

  beforeEach(() => {
    delete window.__READ_FROG_SELECTION_TOOLBAR_READY__
    select("First selection")
    open = vi.fn<(event: Event) => void>()
    window.addEventListener(DEFERRED_SELECTION_OPEN_EVENT, open)
    requestRuntime = vi.fn<() => Promise<boolean>>(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRequest = resolve
        }),
    )
    const spy = vi.spyOn(document, "addEventListener")
    cleanup = registerIframeSelectionTrigger({ requestRuntime, isRuntimeInjected: () => false })
    gesture = spy.mock.calls.find(([name]) => name === "mouseup")![1] as (event: MouseEvent) => void
    spy.mockRestore()
  })
  afterEach(() => {
    cleanup()
    window.removeEventListener(DEFERRED_SELECTION_OPEN_EVENT, open)
    delete window.__READ_FROG_SELECTION_TOOLBAR_READY__
  })

  it("does no work at startup or on page-generated mouse events", () => {
    expect(requestRuntime).not.toHaveBeenCalled()
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
    expect(requestRuntime).not.toHaveBeenCalled()
  })
  it("replays the first gesture only after the runtime and toolbar are ready", async () => {
    trustedGesture()
    expect(requestRuntime).toHaveBeenCalledTimes(1)
    resolveRequest(true)
    await Promise.resolve()
    expect(open).not.toHaveBeenCalled()
    ready()
    expect(open).toHaveBeenCalledTimes(1)
    expect((open.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      text: "First selection",
      x: 80,
      y: 120,
    })
    trustedGesture()
    expect(requestRuntime).toHaveBeenCalledTimes(1)
  })
  it("handles toolbar readiness before the injection response", async () => {
    trustedGesture()
    ready()
    expect(open).not.toHaveBeenCalled()
    resolveRequest(true)
    await Promise.resolve()
    expect(open).toHaveBeenCalledTimes(1)
  })
  it("keeps the latest gesture while one request is loading", async () => {
    trustedGesture()
    select("New selection")
    trustedGesture()
    expect(requestRuntime).toHaveBeenCalledTimes(1)
    resolveRequest(true)
    await Promise.resolve()
    ready()
    expect((open.mock.calls[0]![0] as CustomEvent).detail.text).toBe("New selection")
  })
  it("does not reopen a cleared selection", async () => {
    trustedGesture()
    window.getSelection()!.removeAllRanges()
    resolveRequest(true)
    await Promise.resolve()
    ready()
    expect(open).not.toHaveBeenCalled()
  })
  it("does not replay denied requests or invalidated scripts", async () => {
    trustedGesture()
    resolveRequest(false)
    await Promise.resolve()
    ready()
    expect(open).not.toHaveBeenCalled()
    cleanup()
    trustedGesture()
    expect(requestRuntime).toHaveBeenCalledTimes(1)
  })
})
