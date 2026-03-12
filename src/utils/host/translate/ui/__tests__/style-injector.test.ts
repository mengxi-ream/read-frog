// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

async function loadStyleInjector() {
  vi.resetModules()

  vi.doMock("@/assets/styles/custom-translation-node.css?raw", () => ({
    default: "@import '@/assets/styles/host-theme.css';\n[data-read-frog-custom-translation-style='blur'] { opacity: 0.75; }",
  }))
  vi.doMock("@/assets/styles/host-theme.css?raw", () => ({
    default: ":root { --read-frog-primary: oklch(76.5% 0.177 163.223); }",
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
    expect(document.adoptedStyleSheets[0]?.cssRules[0]?.cssText).toContain("--read-frog-primary")
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
    expect(Array.from(document.adoptedStyleSheets[1]?.cssRules ?? []).map(rule => rule.cssText).join("\n")).toContain("color: blue")
    expect(document.head.querySelector("#read-frog-custom-styles")).toBeNull()
  })
})
