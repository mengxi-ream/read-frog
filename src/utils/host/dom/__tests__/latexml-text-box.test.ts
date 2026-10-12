// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { prepareLatexmlTextBoxes, restoreLatexmlTextBoxes } from "../latexml-text-box"

const originalLocation = window.location

function fixture(extra = ""): HTMLElement {
  const root = document.createElement("main")
  root.innerHTML = `<svg class="ltx_picture" width="550" height="357"><path fill="#f3f8fa" d="M0 0H550V357H0Z"></path><foreignObject><span class="ltx_foreignobject_container"><span class="ltx_foreignobject_content"><span class="ltx_p">An abstract readers must be able to translate.</span></span></span></foreignObject>${extra}</svg>`
  document.body.append(root)
  return root
}

describe("LaTeXML text box adaptation", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: new URL("https://arxiv.org/html/example"),
      configurable: true,
    })
  })
  afterEach(() => {
    restoreLatexmlTextBoxes()
    document.body.replaceChildren()
    Object.defineProperty(window, "location", { value: originalLocation, configurable: true })
  })

  it("is idempotent and restores the same source nodes and listeners", () => {
    const root = fixture()
    const svg = root.querySelector("svg")!
    const content = root.querySelector(".ltx_foreignobject_content")!
    const original = svg.outerHTML
    const listener = vi.fn<() => void>()
    content.addEventListener("click", listener)
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    expect(root.querySelectorAll("[data-read-frog-latexml-text-box]")).toHaveLength(1)
    content.dispatchEvent(new MouseEvent("click"))
    expect(listener).toHaveBeenCalledOnce()
    restoreLatexmlTextBoxes()
    expect(root.querySelector("svg")).toBe(svg)
    expect(svg.outerHTML).toBe(original)
  })

  it.each([
    "<text>A diagram label</text>",
    "<foreignObject><span>Another positioned text island</span></foreignObject>",
    '<circle r="5"></circle>',
  ])("leaves diagrams unchanged: %s", (extra) => {
    const root = fixture(extra)
    const before = root.innerHTML
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    expect(root.innerHTML).toBe(before)
  })

  it("respects exclusions, include scope and hidden ancestors", () => {
    const root = fixture()
    const config = structuredClone(DEFAULT_CONFIG)
    config.siteRules.userRules = [
      { id: "excluded", matches: "arxiv.org", "excludeSelectors.add": [".ltx_picture"] },
    ]
    prepareLatexmlTextBoxes(root, config)
    expect(root.querySelector("svg")).not.toBeNull()
    config.siteRules.userRules = [
      { id: "scoped", matches: "arxiv.org", includeSelectors: ["#other-section"] },
    ]
    prepareLatexmlTextBoxes(root, config)
    expect(root.querySelector("svg")).not.toBeNull()
    root.hidden = true
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    expect(root.querySelector("svg")).not.toBeNull()
  })

  it("follows the reflowLatexmlTextBoxes site rule", () => {
    const root = fixture()
    const disabled = structuredClone(DEFAULT_CONFIG)
    disabled.siteRules.userRules = [
      { id: "no-reflow", matches: "arxiv.org", reflowLatexmlTextBoxes: false },
    ]
    prepareLatexmlTextBoxes(root, disabled)
    expect(root.querySelector("svg")).not.toBeNull()

    Object.defineProperty(window, "location", {
      value: new URL("https://docs.example.org/paper"),
      configurable: true,
    })
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    expect(root.querySelector("svg")).not.toBeNull()
    const enabled = structuredClone(DEFAULT_CONFIG)
    enabled.siteRules.userRules = [
      { id: "latexml-docs", matches: "docs.example.org", reflowLatexmlTextBoxes: true },
    ]
    prepareLatexmlTextBoxes(root, enabled)
    expect(root.querySelector("svg")).toBeNull()
  })

  it("uses the interior color as the background and the frame as the border", () => {
    const root = document.createElement("main")
    root.innerHTML = `<svg class="ltx_picture" width="600" height="376"><g style="--ltx-fill-color:#800000;" fill="#800000"><path d="M0 0H600V376H0Z"></path></g><g style="--ltx-fill-color:#FFF5F5;" fill="#FFF5F5"><path d="M1 1H599V375H1Z"></path></g><g><foreignObject><span class="ltx_foreignobject_container"><span class="ltx_foreignobject_content"><span class="ltx_p">A trajectory readers must be able to translate.</span></span></span></foreignObject></g></svg>`
    document.body.append(root)
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    const card = root.querySelector<HTMLElement>("[data-read-frog-latexml-text-box]")!
    expect(card.style.getPropertyValue("--ltx-bg-color")).toBe("#FFF5F5")
    expect(card.style.getPropertyValue("--ltx-border-color")).toBe("#800000")
  })

  it("leaves theming to the page stylesheet instead of freezing colors", () => {
    const root = fixture()
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    const card = root.querySelector<HTMLElement>("[data-read-frog-latexml-text-box]")!
    expect(card.style.getPropertyValue("--ltx-bg-color")).toBe("#f3f8fa")
    expect(card.style.getPropertyValue("--ltx-border-color")).toBe("")
    expect(card.getAttribute("style")).not.toMatch(/rgb\(/)
  })

  it("can restore the serialized card without in-memory adaptation state", () => {
    const root = fixture()
    const original = root.innerHTML
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    // Reparse the adapted DOM to simulate a new content-script instance.
    const adaptedHTML = root.innerHTML
    root.innerHTML = adaptedHTML
    restoreLatexmlTextBoxes()
    expect(root.innerHTML).toBe(original)
  })

  it("does not adapt other sites or resurrect host-removed content", () => {
    const root = fixture()
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com"),
      configurable: true,
    })
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    expect(root.querySelector("svg")).not.toBeNull()
    Object.defineProperty(window, "location", {
      value: new URL("https://arxiv.org/html/example"),
      configurable: true,
    })
    prepareLatexmlTextBoxes(root, DEFAULT_CONFIG)
    root.replaceChildren()
    restoreLatexmlTextBoxes()
    expect(root.childNodes).toHaveLength(0)
  })
})
