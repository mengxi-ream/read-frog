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
  OVERLAY_SHADOW_ROOT_CSS,
  reattachShadowHostOnBodySwap,
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

describe("reattachShadowHostOnBodySwap", () => {
  let originalBody: HTMLElement

  beforeEach(() => {
    originalBody = document.body
  })

  afterEach(() => {
    if (document.body !== originalBody) document.body.replaceWith(originalBody)
    originalBody.replaceChildren()
  })

  it("preserves the mounted UI across body replacements and stops after cleanup", async () => {
    const shadowHost = document.createElement("read-frog-selection")
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    const button = document.createElement("button")
    shadowRoot.append(button)
    document.body.append(shadowHost)

    const stop = reattachShadowHostOnBodySwap(shadowHost)
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
