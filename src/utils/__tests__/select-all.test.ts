// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { protectSelectAllShadowRoot } from "../select-all"

// Each call adds a window listener that outlives its test, so every test
// mounts a new host and the newest listener's rebuild runs last.
function mountProtectedHost(parent: HTMLElement) {
  const shadowHost = document.createElement("read-frog-selection")
  const wrapper = document.createElement("div")
  shadowHost.attachShadow({ mode: "open" }).append(wrapper)
  parent.append(shadowHost)
  protectSelectAllShadowRoot(shadowHost, wrapper)
  return shadowHost
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
  let readerStyle: HTMLStyleElement

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    readerStyle = document.createElement("style")
    readerStyle.textContent = ".simpread-hidden { display: none; }"
    document.head.append(readerStyle)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.getSelection()?.removeAllRanges()
    readerStyle.remove()
    for (const child of [...document.documentElement.children]) {
      if (child !== document.head && child !== document.body) child.remove()
    }
    document.body.className = ""
    document.body.replaceChildren()
  })

  it("selects the page body but not the extension UI", () => {
    const article = document.createElement("article")
    article.textContent = "Article text"
    document.body.append(article)
    const shadowHost = mountProtectedHost(document.body)

    const event = pressSelectAll()

    const range = window.getSelection()!.getRangeAt(0)
    expect(event.defaultPrevented).toBe(true)
    expect(range.startContainer).toBe(document.body)
    expect(range.intersectsNode(article)).toBe(true)
    expect(range.intersectsNode(shadowHost)).toBe(false)
  })

  it("selects a reader mode's content beside a hidden <body> (#2370)", () => {
    const original = document.createElement("article")
    original.textContent = "Original page"
    document.body.append(original)
    document.body.classList.add("simpread-hidden")
    const reader = document.createElement("sr-read")
    reader.textContent = "Reader text"
    document.documentElement.append(reader)
    const shadowHost = mountProtectedHost(document.documentElement)

    pressSelectAll()

    const range = window.getSelection()!.getRangeAt(0)
    expect(range.intersectsNode(reader)).toBe(true)
    expect(range.intersectsNode(original)).toBe(false)
    expect(range.intersectsNode(document.head)).toBe(false)
    expect(range.intersectsNode(shadowHost)).toBe(false)
  })
})
