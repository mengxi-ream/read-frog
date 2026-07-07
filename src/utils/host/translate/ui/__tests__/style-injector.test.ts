// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

async function loadStyleInjector() {
  vi.resetModules()

  vi.doMock("@/assets/styles/custom-translation-node.css?raw", () => ({
    default: "@import '@/assets/styles/host-theme.css';\n[data-read-frog-custom-translation-style='blur'] { opacity: 0.75; }",
  }))
  vi.doMock("@/assets/styles/host-theme.css?raw", () => ({
    default: ":root { --read-frog-primary: oklch(0.205 0 0); --read-frog-brand: oklch(76.034% 0.12361 82.191); }",
  }))
  vi.doMock("@/assets/styles/translation-node-preset.css?raw", () => ({
    default: ".read-frog-translated-content-wrapper { display: inline; }",
  }))

  return import("../style-injector")
}

describe("style-injector", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""

    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      value: undefined,
    })
  })

  it("injects preset styles into the document", async () => {
    const { ensurePresetStyles } = await loadStyleInjector()

    ensurePresetStyles(document)

    const presetStyle = document.head.querySelector<HTMLStyleElement>("#read-frog-preset-styles")
    expect(presetStyle).not.toBeNull()
    expect(presetStyle?.textContent).toContain(".read-frog-translated-content-wrapper")
    expect(presetStyle?.textContent).toContain(":root")
    expect(presetStyle?.textContent).not.toContain(":host")
  })

  it("uses adoptedStyleSheets for document preset styles when available", async () => {
    const { ensurePresetStyles } = await loadStyleInjector()

    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      value: [],
      writable: true,
    })

    ensurePresetStyles(document)

    expect(document.adoptedStyleSheets).toHaveLength(1)
    expect(document.adoptedStyleSheets[0]?.cssRules[0]?.cssText).toContain("--read-frog-brand")
    expect(document.head.querySelector("#read-frog-preset-styles")).toBeNull()
  })

  it("falls back to style elements when adoptedStyleSheets assignment throws", async () => {
    const { ensurePresetStyles } = await loadStyleInjector()
    const adoptedStyleSheets: CSSStyleSheet[] = []

    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      get() {
        return adoptedStyleSheets
      },
      set() {
        throw new Error("Xray wrapper")
      },
    })

    ensurePresetStyles(document)

    const presetStyle = document.head.querySelector<HTMLStyleElement>("#read-frog-preset-styles")
    expect(presetStyle).not.toBeNull()
    expect(adoptedStyleSheets).toHaveLength(0)
  })

  it("injects preset styles into shadow roots with :host variables", async () => {
    const { ensurePresetStyles } = await loadStyleInjector()
    const host = document.createElement("div")
    const shadow = host.attachShadow({ mode: "open" })

    Object.defineProperty(shadow, "adoptedStyleSheets", {
      configurable: true,
      value: undefined,
    })

    ensurePresetStyles(shadow)

    const presetStyle = shadow.querySelector<HTMLStyleElement>("#read-frog-preset-styles")
    expect(presetStyle).not.toBeNull()
    expect(presetStyle?.textContent).toContain(".read-frog-translated-content-wrapper")
    expect(presetStyle?.textContent).toContain(":host")
    expect(presetStyle?.textContent).not.toContain(":root {")
  })

  it("ensures preset styles exist before custom document CSS", async () => {
    const { ensureCustomCSS } = await loadStyleInjector()

    await ensureCustomCSS(document, ".custom-translation-style { color: red; }")

    const presetStyle = document.head.querySelector<HTMLStyleElement>("#read-frog-preset-styles")
    const customStyle = document.head.querySelector<HTMLStyleElement>("#read-frog-custom-styles")

    expect(presetStyle).not.toBeNull()
    expect(customStyle).not.toBeNull()
    expect(customStyle?.textContent).toContain(".custom-translation-style")
  })

  it("uses adoptedStyleSheets for document custom CSS when available", async () => {
    const { ensureCustomCSS } = await loadStyleInjector()

    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      value: [],
      writable: true,
    })

    await ensureCustomCSS(document, ".custom-translation-style { color: blue; }")

    expect(document.adoptedStyleSheets).toHaveLength(2)
    expect(Array.from(document.adoptedStyleSheets[1]?.cssRules ?? [], rule => rule.cssText).join("\n")).toContain("color: blue")
    expect(document.head.querySelector("#read-frog-custom-styles")).toBeNull()
  })

  it("injects and removes site rule CSS via style elements", async () => {
    const { ensureSiteRuleCSS, removeSiteRuleCSS } = await loadStyleInjector()

    await ensureSiteRuleCSS(document, ".line-clamped { -webkit-line-clamp: unset; }")

    const siteRuleStyle = document.head.querySelector<HTMLStyleElement>("#read-frog-site-rule-styles")
    expect(siteRuleStyle).not.toBeNull()
    expect(siteRuleStyle?.textContent).toContain("line-clamp")

    removeSiteRuleCSS(document)
    expect(document.head.querySelector("#read-frog-site-rule-styles")).toBeNull()
  })

  it("injects and removes site rule CSS via adoptedStyleSheets when available", async () => {
    const { ensureSiteRuleCSS, removeSiteRuleCSS } = await loadStyleInjector()

    Object.defineProperty(document, "adoptedStyleSheets", {
      configurable: true,
      value: [],
      writable: true,
    })

    await ensureSiteRuleCSS(document, ".clamped { max-height: none; }")

    expect(document.adoptedStyleSheets).toHaveLength(1)
    expect(Array.from(document.adoptedStyleSheets[0]?.cssRules ?? [], rule => rule.cssText).join("\n")).toContain("max-height")

    // Re-ensuring reuses the same sheet instead of stacking a new one
    await ensureSiteRuleCSS(document, ".clamped { max-height: none; } .other { height: auto; }")
    expect(document.adoptedStyleSheets).toHaveLength(1)

    removeSiteRuleCSS(document)
    expect(document.adoptedStyleSheets).toHaveLength(0)

    // Removal is idempotent and re-injection works afterwards
    removeSiteRuleCSS(document)
    await ensureSiteRuleCSS(document, ".again { color: red; }")
    expect(document.adoptedStyleSheets).toHaveLength(1)
  })
})
