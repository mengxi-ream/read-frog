// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import { insertShadowRootUIWrapperInto, OVERLAY_SHADOW_ROOT_CSS } from "../shadow-root"

function createOverlayShadowRoot() {
  const shadowHost = document.createElement("read-frog-selection")
  const shadow = shadowHost.attachShadow({ mode: "open" })
  const shadowHtml = document.createElement("html")
  const container = document.createElement("body")
  shadowHtml.append(container)
  shadow.append(shadowHtml)
  document.body.append(shadowHost)

  return { container, shadowHost, shadowHtml }
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
      "background-color: transparent !important",
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
    const { container, shadowHost, shadowHtml } = createOverlayShadowRoot()
    const extensionText = document.createElement("p")
    extensionText.textContent = "Translate action"
    container.append(extensionText)
    insertShadowRootUIWrapperInto(container, shadowHost)

    walkAndLabelElement(document.body, "walk-id", DEFAULT_CONFIG)

    for (const element of [shadowHost, shadowHtml, container, extensionText]) {
      expect(element).not.toHaveAttribute(WALKED_ATTRIBUTE)
      expect(element).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
      expect(element).not.toHaveAttribute(BLOCK_ATTRIBUTE)
    }
  })
})
