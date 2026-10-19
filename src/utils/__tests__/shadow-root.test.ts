// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import {
  insertShadowRootUIWrapperInto,
  keepShadowHostRendered,
  OVERLAY_SHADOW_ROOT_CSS,
} from "../shadow-root"

function createOverlayShadowRoot() {
  const shadowHost = document.createElement("read-frog-selection")
  const shadow = shadowHost.attachShadow({ mode: "open" })
  const shadowStyle = document.createElement("style")
  const container = document.createElement("div")
  shadow.append(shadowStyle, container)
  document.body.append(shadowHost)

  return { container, shadowHost, shadowStyle }
}

describe("insertShadowRootUIWrapperInto", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("defines zero-sized overlay geometry without creating a portal containing block", () => {
    for (const declaration of [
      "display: block !important",
      "height: 0 !important",
      "overflow: visible !important",
      "position: static !important",
      "width: 0 !important",
    ]) {
      expect(OVERLAY_SHADOW_ROOT_CSS).toContain(declaration)
    }

    expect(OVERLAY_SHADOW_ROOT_CSS).not.toContain("position: relative !important")
  })

  it("marks the shadow host and wrapper as non-translatable", () => {
    const { container, shadowHost } = createOverlayShadowRoot()

    const wrapper = insertShadowRootUIWrapperInto(container, shadowHost)

    expect(shadowHost.classList).toContain(NOTRANSLATE_CLASS)
    expect(wrapper.parentElement).toBe(container)
    expect(wrapper.classList).toContain(NOTRANSLATE_CLASS)
    expect(wrapper.classList).toContain("z-[2147483647]")
  })

  it("prevents page translation from walking the extension shadow tree", () => {
    const { container, shadowHost, shadowStyle } = createOverlayShadowRoot()
    const extensionText = document.createElement("p")
    extensionText.textContent = "Translate action"
    container.append(extensionText)
    insertShadowRootUIWrapperInto(container, shadowHost)

    walkAndLabelElement(document.body, "walk-id", DEFAULT_CONFIG)

    for (const element of [shadowHost, shadowStyle, container, extensionText]) {
      expect(element).not.toHaveAttribute(WALKED_ATTRIBUTE)
      expect(element).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
      expect(element).not.toHaveAttribute(BLOCK_ATTRIBUTE)
    }
  })
})

describe("keepShadowHostRendered", () => {
  let originalBody: HTMLElement
  let readerStyle: HTMLStyleElement
  const stops: Array<() => void> = []

  beforeEach(() => {
    originalBody = document.body
    // SimpRead hides <body> with a class, not an inline style (#2370).
    readerStyle = document.createElement("style")
    readerStyle.textContent = ".simpread-hidden { display: none; }"
    document.head.append(readerStyle)
  })

  afterEach(() => {
    for (const stop of stops.splice(0)) stop()
    readerStyle.remove()
    for (const child of [...document.documentElement.children]) {
      if (child !== document.head && child !== document.body) child.remove()
    }
    if (document.body !== originalBody) document.body.replaceWith(originalBody)
    originalBody.className = ""
    originalBody.removeAttribute("style")
    originalBody.replaceChildren()
  })

  function mountHost() {
    const shadowHost = document.createElement("read-frog-selection")
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    const button = document.createElement("button")
    shadowRoot.append(button)
    document.body.append(shadowHost)
    return { shadowHost, shadowRoot, button }
  }

  function keep(shadowHost: HTMLElement) {
    const stop = keepShadowHostRendered(shadowHost)
    stops.push(stop)
    return stop
  }

  function enterReaderMode() {
    document.body.classList.add("simpread-hidden")
    const reader = document.createElement("div")
    reader.append(document.createElement("sr-read"))
    document.documentElement.append(reader)
    return reader
  }

  it("leaves the host in place on an ordinary page", async () => {
    const { shadowHost } = mountHost()
    const article = document.createElement("article")
    document.body.prepend(article)
    keep(shadowHost)

    const moves: MutationRecord[] = []
    const watcher = new MutationObserver((records) => moves.push(...records))
    watcher.observe(document.documentElement, { childList: true, subtree: true })

    document.body.classList.add("modal-open")
    document.body.style.overflow = "hidden"
    document.documentElement.classList.add("dark")
    await Promise.resolve()

    watcher.disconnect()
    document.documentElement.classList.remove("dark")
    expect(shadowHost.parentElement).toBe(document.body)
    expect(moves).toEqual([])
  })

  it("moves the host beside a reader mode's content while <body> is hidden, and back after", async () => {
    const { shadowHost, shadowRoot, button } = mountHost()
    keep(shadowHost)

    const reader = enterReaderMode()
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(document.documentElement)
    expect(reader.compareDocumentPosition(shadowHost)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(shadowHost.shadowRoot).toBe(shadowRoot)
    expect(shadowRoot.firstChild).toBe(button)

    reader.remove()
    document.body.classList.remove("simpread-hidden")
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(document.body)
  })

  it("follows an inline display: none on <body> too", async () => {
    const { shadowHost } = mountHost()
    keep(shadowHost)

    document.body.style.display = "none"
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(document.documentElement)

    document.body.style.removeProperty("display")
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(document.body)
  })

  it("moves the host at once when the reader mode opened before the UI mounted", () => {
    enterReaderMode()
    const { shadowHost } = mountHost()

    keep(shadowHost)

    expect(shadowHost.parentElement).toBe(document.documentElement)
  })

  it("watches a replacement <body> for being hidden and shown", async () => {
    const { shadowHost } = mountHost()
    keep(shadowHost)

    const hiddenBody = document.createElement("body")
    hiddenBody.className = "simpread-hidden"
    originalBody.replaceWith(hiddenBody)
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(document.documentElement)

    hiddenBody.classList.remove("simpread-hidden")
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(hiddenBody)
  })

  it.each([
    ["in the page's light DOM", false],
    ["inside a page component's shadow root", true],
  ])("leaves a host moved into a modal dialog %s where it is", async (_where, inShadowRoot) => {
    const { shadowHost } = mountHost()
    keep(shadowHost)

    // What createModalDialogHostController does for a selection in an open modal.
    const dialog = document.createElement("dialog")
    const slot = document.createElement("read-frog-modal-dialog-host-slot")
    dialog.append(slot)
    if (inShadowRoot) {
      const component = document.createElement("page-modal")
      component.attachShadow({ mode: "open" }).append(dialog)
      document.body.append(component)
    } else {
      document.body.append(dialog)
    }
    slot.append(shadowHost)

    document.body.classList.add("modal-open")
    document.documentElement.classList.add("dark")
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(slot)

    document.body.classList.add("simpread-hidden")
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(slot)

    document.documentElement.classList.remove("dark")
  })

  it("preserves the mounted UI across body replacements and stops after cleanup", async () => {
    const shadowHost = document.createElement("read-frog-selection")
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    const button = document.createElement("button")
    shadowRoot.append(button)
    document.body.append(shadowHost)

    const stop = keep(shadowHost)
    document.body.append(document.createElement("main"))
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(originalBody)

    const secondBody = document.createElement("body")
    originalBody.replaceWith(secondBody)
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(secondBody)
    expect(shadowHost.shadowRoot).toBe(shadowRoot)
    expect(shadowRoot.firstChild).toBe(button)

    const thirdBody = document.createElement("body")
    secondBody.replaceWith(thirdBody)
    await Promise.resolve()
    expect(shadowHost.parentElement).toBe(thirdBody)

    stop()
    thirdBody.replaceWith(document.createElement("body"))
    await Promise.resolve()
    expect(shadowHost.isConnected).toBe(false)
  })
})
