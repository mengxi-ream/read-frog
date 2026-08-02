// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PARAGRAPH_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { extractTextContent, walkAndLabelElement } from "../traversal"

function setUrl(url: string) {
  // jsdom exposes location as read-only; override via defineProperty
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
  })
}

function configWithDisabledBuiltInRules(ids: string[]): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules = { userRules: [], disabledBuiltInRules: ids }
  return config
}

// End-to-end coverage for the sillytavern built-in rule (issue #1951):
// `dontWalkButTranslateTags.remove: ["CODE"]` turns <code> into a normally
// walked inline element on localhost, so a code-only <p> gets labeled and
// its narration text reaches extraction.
describe("sillytavern tag-set rule (#1951)", () => {
  it("labels a code-only paragraph on localhost", () => {
    setUrl("http://localhost:8000/")
    document.body.innerHTML = `<div class="mes_text"><p><code>The wind howled through the pass.</code></p></div>`
    const container = document.body.firstElementChild as HTMLElement
    const p = container.querySelector("p")!

    walkAndLabelElement(container, "walk-1", DEFAULT_CONFIG)

    expect(p.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(extractTextContent(p, DEFAULT_CONFIG)).toBe("The wind howled through the pass.")
  })

  it("keeps mixed paragraphs intact, code text included", () => {
    setUrl("http://localhost:8000/")
    document.body.innerHTML = `<div class="mes_text"><p>before <code>mid</code> after</p></div>`
    const container = document.body.firstElementChild as HTMLElement
    const p = container.querySelector("p")!

    walkAndLabelElement(container, "walk-2", DEFAULT_CONFIG)

    expect(p.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(true)
    expect(extractTextContent(p, DEFAULT_CONFIG)).toBe("before mid after")
  })

  it("still blocks fenced code blocks at the PRE level", () => {
    setUrl("http://localhost:8000/")
    document.body.innerHTML = `<div class="mes_text"><pre><code>const fenced = true</code></pre></div>`
    const container = document.body.firstElementChild as HTMLElement
    const pre = container.querySelector("pre")!
    const blocked: HTMLElement[] = []

    walkAndLabelElement(container, "walk-3", DEFAULT_CONFIG, {
      onBlockedElement: (element) => blocked.push(element),
    })

    expect(blocked).toContain(pre)
    expect(pre.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
    expect(container.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  it("keeps the default CODE behavior on other hosts", () => {
    setUrl("https://example.org/article")
    document.body.innerHTML = `<div class="mes_text"><p><code>The wind howled through the pass.</code></p></div>`
    const container = document.body.firstElementChild as HTMLElement
    const p = container.querySelector("p")!

    walkAndLabelElement(container, "walk-4", DEFAULT_CONFIG)

    expect(p.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })

  it("restores the default behavior when the built-in rule is disabled", () => {
    setUrl("http://localhost:8000/")
    document.body.innerHTML = `<div class="mes_text"><p><code>The wind howled through the pass.</code></p></div>`
    const container = document.body.firstElementChild as HTMLElement
    const p = container.querySelector("p")!

    walkAndLabelElement(container, "walk-5", configWithDisabledBuiltInRules(["sillytavern"]))

    expect(p.hasAttribute(PARAGRAPH_ATTRIBUTE)).toBe(false)
  })
})
