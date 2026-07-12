// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isSiteRuleExcludedElement, isSiteRuleForceBlockElement } from "../filter"

function setHost(host: string) {
  // jsdom exposes location as read-only; override via defineProperty
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
  })
}

describe("isSiteRuleForceBlockElement", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("matches task-lists element on github.com", () => {
    setHost("github.com")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host", () => {
    setHost("non-configured-example.org")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(false)
  })

  it("matches shreddit-post-text-body element on www.reddit.com", () => {
    setHost("www.reddit.com")

    const postTextBody = document.createElement("shreddit-post-text-body")
    document.body.appendChild(postTextBody)

    expect(isSiteRuleForceBlockElement(postTextBody, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match element outside configured parent on configured host", () => {
    setHost("github.com")

    const other = document.createElement("div")
    document.body.appendChild(other)

    expect(isSiteRuleForceBlockElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("still matches when the URL includes a port", () => {
    setHost("github.com:3000")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("github.com")

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host when host !== hostname", () => {
    setHost("non-configured-example.org:8080")

    const taskLists = document.createElement("task-lists")
    document.body.appendChild(taskLists)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("non-configured-example.org")

    expect(isSiteRuleForceBlockElement(taskLists, DEFAULT_CONFIG)).toBe(false)
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

    expect(isSiteRuleForceBlockElement(docsumWrap, DEFAULT_CONFIG)).toBe(true)
  })

  it("matches a.docsum-title on pubmed.ncbi.nlm.nih.gov", () => {
    setHost("pubmed.ncbi.nlm.nih.gov")

    const title = document.createElement("a")
    title.className = "docsum-title"
    document.body.appendChild(title)

    expect(isSiteRuleForceBlockElement(title, DEFAULT_CONFIG)).toBe(true)
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
