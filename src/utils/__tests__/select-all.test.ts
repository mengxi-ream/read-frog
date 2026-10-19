// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { protectSelectAllShadowRoot } from "../select-all"

// Each call adds a window listener that outlives its test, so every test mounts
// new hosts. The selection toolbar and the floating button each protect their
// own host, from separate content scripts, so most tests protect two.
function createHost(tagName: string) {
  const shadowHost = document.createElement(tagName)
  const wrapper = document.createElement("div")
  const label = document.createElement("p")
  label.textContent = `${tagName} text`
  const button = document.createElement("button")
  const input = document.createElement("input")
  wrapper.append(label, button, input)
  shadowHost.attachShadow({ mode: "open" }).append(wrapper)
  document.body.append(shadowHost)
  return { shadowHost, wrapper, button, input }
}

function protect(host: ReturnType<typeof createHost>) {
  protectSelectAllShadowRoot(host.shadowHost, host.wrapper)
}

function hover({ shadowHost }: ReturnType<typeof createHost>) {
  const matches = shadowHost.matches.bind(shadowHost)
  vi.spyOn(shadowHost, "matches").mockImplementation(
    (selector) => selector === ":hover" || matches(selector),
  )
}

function pressSelectAll() {
  const event = new KeyboardEvent("keydown", {
    key: "a",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  document.body.dispatchEvent(event)
  return event
}

describe("protectSelectAllShadowRoot", () => {
  let article: HTMLElement

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    article = document.createElement("article")
    article.textContent = "Article text"
    document.body.append(article)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.getSelection()?.removeAllRanges()
    document.body.replaceChildren()
  })

  it.each([
    ["the toolbar's listener runs first", false],
    ["the floating button's listener runs first", true],
  ])("selects the page without any Read Frog UI when %s", (_, floatingButtonFirst) => {
    const toolbar = createHost("read-frog-selection")
    const floatingButton = createHost("read-frog")
    for (const host of floatingButtonFirst
      ? [floatingButton, toolbar]
      : [toolbar, floatingButton]) {
      protect(host)
    }

    const event = pressSelectAll()

    const selection = window.getSelection()!
    const range = selection.getRangeAt(0)
    expect(event.defaultPrevented).toBe(true)
    expect(range.intersectsNode(article)).toBe(true)
    expect(range.intersectsNode(toolbar.shadowHost)).toBe(false)
    expect(range.intersectsNode(floatingButton.shadowHost)).toBe(false)
  })

  it("selects only the Read Frog UI under the pointer, whichever listener runs last", () => {
    const toolbar = createHost("read-frog-selection")
    const floatingButton = createHost("read-frog")
    protect(toolbar)
    protect(floatingButton)
    hover(toolbar)
    // jsdom drops a range inside a shadow root, as the spec says; Chrome keeps it.
    const addRange = vi.spyOn(Selection.prototype, "addRange")

    const event = pressSelectAll()

    expect(event.defaultPrevented).toBe(true)
    expect(addRange).toHaveBeenCalledTimes(1)
    const range = addRange.mock.calls[0]![0]
    expect(range.startContainer).toBe(toolbar.wrapper)
    expect(range.toString()).toBe("read-frog-selection text")
  })

  // Opening the translation card puts the focus on one of its buttons.
  it("selects the page without any Read Frog UI while a button in it has the focus", () => {
    const toolbar = createHost("read-frog-selection")
    const floatingButton = createHost("read-frog")
    protect(toolbar)
    protect(floatingButton)
    toolbar.button.focus()
    expect(document.activeElement).toBe(toolbar.shadowHost)

    const event = pressSelectAll()

    const range = window.getSelection()!.getRangeAt(0)
    expect(event.defaultPrevented).toBe(true)
    expect(range.intersectsNode(article)).toBe(true)
    expect(range.intersectsNode(toolbar.shadowHost)).toBe(false)
    expect(range.intersectsNode(floatingButton.shadowHost)).toBe(false)
  })

  it("leaves Ctrl+A to a text field in Read Frog UI", () => {
    const toolbar = createHost("read-frog-selection")
    const floatingButton = createHost("read-frog")
    protect(toolbar)
    protect(floatingButton)
    toolbar.input.focus()

    expect(pressSelectAll().defaultPrevented).toBe(false)
  })

  it("leaves Ctrl+A to a text field on the page", () => {
    const toolbar = createHost("read-frog-selection")
    protect(toolbar)
    hover(toolbar)
    const input = document.createElement("input")
    document.body.prepend(input)
    input.focus()

    expect(pressSelectAll().defaultPrevented).toBe(false)
  })
})
