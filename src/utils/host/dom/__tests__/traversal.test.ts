// @vitest-environment jsdom
import type { SiteRule } from "@/types/config/site-rules"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { isNaturalBlockTransNode, isNaturalInlineTransNode } from "../filter"
import { extractTextContent, walkAndLabelElement } from "../traversal"

function configWithSiteRule(rule: Omit<SiteRule, "id" | "matches">) {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules.userRules = [
    {
      id: "node-selector-test",
      matches: window.location.hostname,
      ...rule,
    },
  ]
  return config
}

function fixture(markup: string): HTMLElement {
  const host = document.createElement("main")
  host.innerHTML = markup
  document.body.append(host)
  return host
}

describe("extractTextContent", () => {
  describe("text node whitespace normalization", () => {
    it("should return trimmed text without spaces when only newlines are trimmed", () => {
      const textNode = document.createTextNode("\n\nHello\n\n")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe("Hello")
    })

    it("should add leading space when leading whitespace contains spaces", () => {
      const textNode = document.createTextNode("  Hello")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" Hello")
    })

    it("should add trailing space when trailing whitespace contains spaces", () => {
      const textNode = document.createTextNode("Hello  ")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe("Hello ")
    })

    it("should add both spaces when both sides have non-newline whitespace", () => {
      const textNode = document.createTextNode("  Hello  ")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" Hello ")
    })

    it("should add spaces when whitespace includes both newlines and spaces", () => {
      const textNode = document.createTextNode("\n  Hello  \n")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" Hello ")
    })

    it("should add leading space when leading has newline then space", () => {
      const textNode = document.createTextNode("\n Hello")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" Hello")
    })

    it("should add trailing space when trailing has space then newline", () => {
      const textNode = document.createTextNode("Hello \n")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe("Hello ")
    })

    it("should not add spaces for text without any whitespace", () => {
      const textNode = document.createTextNode("Hello")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe("Hello")
    })

    it("should return single space for whitespace-only text", () => {
      const textNode = document.createTextNode("   ")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" ")
    })

    it("should return single space for newline-only text", () => {
      const textNode = document.createTextNode("\n\n")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" ")
    })

    it("should return single space for empty text", () => {
      const textNode = document.createTextNode("")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" ")
    })

    it("should handle tabs as non-newline whitespace", () => {
      const textNode = document.createTextNode("\tHello\t")
      expect(extractTextContent(textNode, DEFAULT_CONFIG)).toBe(" Hello ")
    })
  })

  describe("br element handling", () => {
    it("should return newline for BR element", () => {
      const br = document.createElement("br")
      expect(extractTextContent(br, DEFAULT_CONFIG)).toBe("\n")
    })
  })

  describe("nested element extraction", () => {
    it("should extract text from nested elements", () => {
      const div = document.createElement("div")
      div.innerHTML = "Hello <span>World</span>"
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Hello World")
    })

    it("should handle BR in nested content", () => {
      const div = document.createElement("div")
      div.innerHTML = "Line1<br>Line2"
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Line1\nLine2")
    })

    it("should preserve spaces between inline elements", () => {
      const div = document.createElement("div")
      div.innerHTML = "<span>Hello</span> <span>World</span>"
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Hello World")
    })

    it("should include ruby text and exclude rp/rt elements", () => {
      const div = document.createElement("div")
      div.innerHTML = "Before<ruby>大阪<rp>(</rp><rt>Osaka</rt><rp>)</rp></ruby>After"
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Before大阪After")
    })
  })

  describe("visually hidden element exclusion", () => {
    it("should exclude sr-only child element text", () => {
      const div = document.createElement("div")
      div.innerHTML = 'Visible text<span class="sr-only">Hidden text</span>'
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Visible text")
    })

    it("should exclude visually-hidden child element text", () => {
      const div = document.createElement("div")
      div.innerHTML = 'Visible text<span class="visually-hidden">Hidden text</span>'
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Visible text")
    })

    it("should exclude sr-only text mixed with visible siblings", () => {
      const div = document.createElement("div")
      div.innerHTML = '<span>Hello</span><span class="sr-only">Secret</span> <span>World</span>'
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("Hello World")
    })
  })

  describe("extension wrapper exclusion", () => {
    it("should exclude translated wrapper text but keep host notranslate children (issues #1831, #249)", () => {
      const p = document.createElement("p")
      p.innerHTML =
        'Host <span class="notranslate">keep</span><span class="notranslate read-frog-translated-content-wrapper">译文</span>'
      const extracted = extractTextContent(p, DEFAULT_CONFIG)
      expect(extracted).toContain("Host")
      expect(extracted).toContain("keep")
      expect(extracted).not.toContain("译文")
    })

    it("should exclude nested translated wrappers deep inside the subtree", () => {
      const div = document.createElement("div")
      div.innerHTML =
        '<span>Outer</span><em>Inner<span class="read-frog-translated-content-wrapper">内层译文</span></em>'
      expect(extractTextContent(div, DEFAULT_CONFIG)).toBe("OuterInner")
    })
  })
})

describe("site rule node selectors", () => {
  it("forces inline and block node classifications independently of computed display", () => {
    const host = fixture(`
      <span id="forced-block" style="display:inline">forced block text</span>
      <div id="forced-inline" style="display:block">forced inline text</div>
    `)
    const config = configWithSiteRule({
      forceBlockNodeSelectors: ["#forced-block"],
      forceInlineNodeSelectors: ["#forced-inline"],
    })

    walkAndLabelElement(host, "node-forcing", config)

    const forcedBlock = host.querySelector<HTMLElement>("#forced-block")!
    expect(forcedBlock).toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(forcedBlock).not.toHaveAttribute(INLINE_ATTRIBUTE)
    expect(isNaturalInlineTransNode(forcedBlock)).toBe(true)
    expect(isNaturalBlockTransNode(forcedBlock)).toBe(false)

    const forcedInline = host.querySelector<HTMLElement>("#forced-inline")!
    expect(forcedInline).toHaveAttribute(INLINE_ATTRIBUTE)
    expect(forcedInline).not.toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(isNaturalBlockTransNode(forcedInline)).toBe(true)
    expect(isNaturalInlineTransNode(forcedInline)).toBe(false)
    expect(host).toHaveAttribute(PARAGRAPH_ATTRIBUTE)

    host.remove()
  })

  it("gives forced block nodes priority over forced inline nodes", () => {
    const host = fixture('<div id="conflict">conflicting selector text</div>')
    const config = configWithSiteRule({
      forceBlockNodeSelectors: ["#conflict"],
      forceInlineNodeSelectors: ["#conflict"],
    })

    walkAndLabelElement(host, "node-conflict", config)

    const conflict = host.querySelector<HTMLElement>("#conflict")!
    expect(conflict).toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(conflict).not.toHaveAttribute(INLINE_ATTRIBUTE)
    host.remove()
  })

  it("keeps a forced block node self-only instead of propagating block state to its parent", () => {
    const host = fixture(`
      <span id="parent" style="display:inline">
        <em id="child" style="display:inline">nested inline text</em>
      </span>
    `)
    const config = configWithSiteRule({ forceBlockNodeSelectors: ["#child"] })

    walkAndLabelElement(host, "self-only-block", config)

    const child = host.querySelector<HTMLElement>("#child")!
    expect(child).toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(child).not.toHaveAttribute(INLINE_ATTRIBUTE)

    const parent = host.querySelector<HTMLElement>("#parent")!
    expect(parent).toHaveAttribute(INLINE_ATTRIBUTE)
    expect(parent).not.toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(parent).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
    host.remove()
  })

  it("keeps structural and descendant block priority over a forced inline node", () => {
    const host = fixture(`
      <h2 id="structural">Heading text</h2>
      <span id="descendant" style="display:inline"><h3>Nested heading</h3></span>
    `)
    const config = configWithSiteRule({
      forceInlineNodeSelectors: ["#structural", "#descendant"],
    })

    walkAndLabelElement(host, "structural-priority", config)

    for (const id of ["structural", "descendant"]) {
      const element = host.querySelector<HTMLElement>(`#${id}`)!
      expect(element).toHaveAttribute(BLOCK_ATTRIBUTE)
      expect(element).not.toHaveAttribute(INLINE_ATTRIBUTE)
      expect(isNaturalBlockTransNode(element)).toBe(true)
    }
    host.remove()
  })

  it("does not label empty ordinary elements even when a node selector matches", () => {
    const host = fixture('<div id="empty"></div>')
    const config = configWithSiteRule({ forceBlockNodeSelectors: ["#empty"] })

    walkAndLabelElement(host, "empty-node", config)

    const empty = host.querySelector<HTMLElement>("#empty")!
    expect(empty).toHaveAttribute(WALKED_ATTRIBUTE, "empty-node")
    expect(empty).not.toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(empty).not.toHaveAttribute(INLINE_ATTRIBUTE)
    host.remove()
  })

  it("does not let node selectors reopen excluded, preserved, notranslate, or PRE nodes", () => {
    const host = fixture(`
      <div id="excluded">excluded text</div>
      <div id="preserved">preserved text</div>
      <div id="notranslate" class="notranslate">host text</div>
      <pre id="pre">const answer = 42</pre>
    `)
    const config = configWithSiteRule({
      forceBlockNodeSelectors: ["#excluded", "#preserved", "#notranslate", "#pre"],
      excludeSelectors: ["#excluded"],
      preserveTextSelectors: ["#preserved"],
    })

    walkAndLabelElement(host, "blocked-node", config)

    for (const id of ["excluded", "preserved", "notranslate", "pre"]) {
      const element = host.querySelector<HTMLElement>(`#${id}`)!
      expect(element).not.toHaveAttribute(WALKED_ATTRIBUTE)
      expect(element).not.toHaveAttribute(BLOCK_ATTRIBUTE)
      expect(element).not.toHaveAttribute(INLINE_ATTRIBUTE)
    }
    host.remove()
  })

  it("does not let a node selector enlarge a strict include scope", () => {
    const host = fixture(`
      <article><span id="inside">included paragraph text</span></article>
      <span id="outside">outside paragraph text</span>
    `)
    const config = configWithSiteRule({
      includeSelectors: ["article"],
      forceBlockNodeSelectors: ["#outside"],
    })

    walkAndLabelElement(host, "include-boundary", config)

    expect(host.querySelector("#inside")).toHaveAttribute(PARAGRAPH_ATTRIBUTE)
    expect(host.querySelector("#outside")).toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(host.querySelector("#outside")).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
    host.remove()
  })

  it("ignores style-only selectors while assigning traversal labels", () => {
    const host = fixture(`
      <span id="block-style" style="display:inline">inline source text</span>
      <div id="inline-style" style="display:block">block source text</div>
    `)
    const config = configWithSiteRule({
      forceBlockStyleSelectors: ["#block-style"],
      forceInlineStyleSelectors: ["#inline-style"],
    })

    walkAndLabelElement(host, "style-only", config)

    expect(host.querySelector("#block-style")).toHaveAttribute(INLINE_ATTRIBUTE)
    expect(host.querySelector("#block-style")).not.toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(host.querySelector("#inline-style")).toHaveAttribute(BLOCK_ATTRIBUTE)
    expect(host.querySelector("#inline-style")).not.toHaveAttribute(INLINE_ATTRIBUTE)
    host.remove()
  })
})
