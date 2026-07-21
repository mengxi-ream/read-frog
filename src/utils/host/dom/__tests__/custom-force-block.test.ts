// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  isSiteRuleExcludedElement,
  isSiteRuleForceBlockNodeElement,
  isSiteRuleForceBlockStyleElement,
  isSiteRuleForceInlineNodeElement,
  isSiteRuleForceInlineStyleElement,
} from "../filter"

function setHost(host: string) {
  // jsdom exposes location as read-only; override via defineProperty
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
  })
}

describe("site-rule force selectors", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("matches task-lists element on github.com", () => {
    setHost("github.com")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(isSiteRuleForceBlockNodeElement(taskLists, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host", () => {
    setHost("non-configured-example.org")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(isSiteRuleForceBlockNodeElement(taskLists, DEFAULT_CONFIG)).toBe(false)
  })

  it("matches shreddit-post-text-body element on www.reddit.com", () => {
    setHost("www.reddit.com")

    const postTextBody = document.createElement("shreddit-post-text-body")
    document.body.appendChild(postTextBody)

    expect(isSiteRuleForceBlockNodeElement(postTextBody, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match element outside configured parent on configured host", () => {
    setHost("github.com")

    const other = document.createElement("div")
    document.body.appendChild(other)

    expect(isSiteRuleForceBlockNodeElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("still matches when the URL includes a port", () => {
    setHost("github.com:3000")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("github.com")

    expect(isSiteRuleForceBlockNodeElement(taskLists, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host when host !== hostname", () => {
    setHost("non-configured-example.org:8080")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("non-configured-example.org")

    expect(isSiteRuleForceBlockNodeElement(taskLists, DEFAULT_CONFIG)).toBe(false)
  })

  // PubMed search results wrap each item's content in inline-block containers
  // (.docsum-wrap / a.docsum-title), which the shallow classifier would treat as
  // inline and collapse the whole result into one piled-up translation unit.
  // Forcing them to block keeps the title and abstract snippet as separate units.
  it("matches .docsum-wrap on pubmed.ncbi.nlm.nih.gov", () => {
    setHost("pubmed.ncbi.nlm.nih.gov")

    const docsumWrap = document.createElement("div")
    docsumWrap.className = "docsum-wrap"
    document.body.appendChild(docsumWrap)

    expect(isSiteRuleForceBlockNodeElement(docsumWrap, DEFAULT_CONFIG)).toBe(true)
  })

  it("matches a.docsum-title on pubmed.ncbi.nlm.nih.gov", () => {
    setHost("pubmed.ncbi.nlm.nih.gov")

    const title = document.createElement("a")
    title.className = "docsum-title"
    document.body.appendChild(title)

    expect(isSiteRuleForceBlockNodeElement(title, DEFAULT_CONFIG)).toBe(true)
  })

  it("matches node and style selectors on their own independent axes", () => {
    setHost("example.com")
    const config: Config = {
      ...DEFAULT_CONFIG,
      siteRules: {
        disabledBuiltInRules: [],
        userRules: [
          {
            id: "four-axes",
            matches: "example.com",
            forceBlockNodeSelectors: [".block-node"],
            forceBlockStyleSelectors: [".block-style"],
            forceInlineNodeSelectors: [".inline-node"],
            forceInlineStyleSelectors: [".inline-style"],
          },
        ],
      },
    }
    const element = document.createElement("span")
    element.className = "block-node"
    document.body.appendChild(element)

    expect(isSiteRuleForceBlockNodeElement(element, config)).toBe(true)
    expect(isSiteRuleForceBlockStyleElement(element, config)).toBe(false)
    expect(isSiteRuleForceInlineNodeElement(element, config)).toBe(false)
    expect(isSiteRuleForceInlineStyleElement(element, config)).toBe(false)

    element.className = "block-style"
    expect(isSiteRuleForceBlockNodeElement(element, config)).toBe(false)
    expect(isSiteRuleForceBlockStyleElement(element, config)).toBe(true)
    expect(isSiteRuleForceInlineNodeElement(element, config)).toBe(false)
    expect(isSiteRuleForceInlineStyleElement(element, config)).toBe(false)

    element.className = "inline-node"
    expect(isSiteRuleForceBlockNodeElement(element, config)).toBe(false)
    expect(isSiteRuleForceBlockStyleElement(element, config)).toBe(false)
    expect(isSiteRuleForceInlineNodeElement(element, config)).toBe(true)
    expect(isSiteRuleForceInlineStyleElement(element, config)).toBe(false)

    element.className = "inline-style"
    expect(isSiteRuleForceBlockNodeElement(element, config)).toBe(false)
    expect(isSiteRuleForceBlockStyleElement(element, config)).toBe(false)
    expect(isSiteRuleForceInlineNodeElement(element, config)).toBe(false)
    expect(isSiteRuleForceInlineStyleElement(element, config)).toBe(true)
  })
})

describe("isSiteRuleExcludedElement", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  // The leading result index number would otherwise be translated as its own
  // throwaway unit (one wasted call per result), so it is excluded.
  it("excludes .search-result-position on pubmed.ncbi.nlm.nih.gov", () => {
    setHost("pubmed.ncbi.nlm.nih.gov")

    const position = document.createElement("label")
    position.className = "search-result-position"
    document.body.appendChild(position)

    expect(isSiteRuleExcludedElement(position, DEFAULT_CONFIG)).toBe(true)
  })
})
