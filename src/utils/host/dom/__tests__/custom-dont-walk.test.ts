// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  hasNoWalkAncestor,
  isDontWalkIntoAndDontTranslateAsChildElement,
  isSiteRuleExcludedElement,
} from "../filter"
import { extractTextContent } from "../traversal"

function setHost(host: string) {
  // jsdom exposes location as read-only; override via defineProperty
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
  })
}

function configWithSiteRules(siteRules: Config["siteRules"]): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules = siteRules
  return config
}

describe("isSiteRuleExcludedElement", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("loads rules and identifies elements on configured host", () => {
    setHost("chatgpt.com")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")
    document.body.appendChild(proseMirror)

    expect(isSiteRuleExcludedElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    // integration via filter.ts
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host", () => {
    setHost("non-configured-example.org")

    const el = document.createElement("div")
    document.body.appendChild(el)

    expect(isSiteRuleExcludedElement(el, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(el, DEFAULT_CONFIG)).toBe(false)
  })

  it("only matches configured element when multiple nodes present on chatgpt.com", () => {
    setHost("chatgpt.com")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")

    const other = document.createElement("div")

    document.body.appendChild(proseMirror)
    document.body.appendChild(other)

    expect(isSiteRuleExcludedElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    expect(isSiteRuleExcludedElement(other, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("walks ChatGPT assistant prose while keeping editors and code blocks protected (#1912)", () => {
    setHost("chatgpt.com")

    const assistantResponse = document.createElement("div")
    assistantResponse.className = "markdown prose"

    const paragraph = document.createElement("p")
    paragraph.textContent = "Readable assistant response"

    const pre = document.createElement("pre")
    const code = document.createElement("code")
    code.textContent = "const shouldStayUntranslated = true"
    pre.appendChild(code)

    const promptEditor = document.createElement("div")
    promptEditor.className = "ProseMirror"
    promptEditor.textContent = "User prompt"

    assistantResponse.append(paragraph, pre)
    document.body.append(assistantResponse, promptEditor)

    expect(isSiteRuleExcludedElement(paragraph, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(paragraph, DEFAULT_CONFIG)).toBe(false)
    expect(extractTextContent(assistantResponse, DEFAULT_CONFIG)).toBe(
      "Readable assistant response",
    )

    expect(isDontWalkIntoAndDontTranslateAsChildElement(pre, DEFAULT_CONFIG)).toBe(true)
    expect(isSiteRuleExcludedElement(promptEditor, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(promptEditor, DEFAULT_CONFIG)).toBe(true)
  })

  it("still matches when the URL includes a port (host !== hostname)", () => {
    setHost("chatgpt.com:3000")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")

    const other = document.createElement("div")

    document.body.appendChild(proseMirror)
    document.body.appendChild(other)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("chatgpt.com")

    expect(isSiteRuleExcludedElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    expect(isSiteRuleExcludedElement(other, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("does not match on non-configured host when host !== hostname", () => {
    setHost("non-configured-example.org:8080")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")

    const other = document.createElement("div")

    document.body.appendChild(proseMirror)
    document.body.appendChild(other)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("non-configured-example.org")

    expect(isSiteRuleExcludedElement(proseMirror, DEFAULT_CONFIG)).toBe(false)
    expect(isSiteRuleExcludedElement(other, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("matches shreddit-post-flair element on www.reddit.com", () => {
    setHost("www.reddit.com")

    const postFlair = document.createElement("shreddit-post-flair")
    document.body.appendChild(postFlair)

    expect(isSiteRuleExcludedElement(postFlair, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(postFlair, DEFAULT_CONFIG)).toBe(true)
  })

  it("matches github review diff table and blocks its descendants", () => {
    setHost("github.com")

    const diffTable = document.createElement("table")
    diffTable.classList.add("diff-table")

    const tbody = document.createElement("tbody")
    const tr = document.createElement("tr")
    const td = document.createElement("td")
    td.textContent = "const foo = 1"

    tr.appendChild(td)
    tbody.appendChild(tr)
    diffTable.appendChild(tbody)
    document.body.appendChild(diffTable)

    expect(isSiteRuleExcludedElement(diffTable, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(diffTable, DEFAULT_CONFIG)).toBe(true)
    expect(hasNoWalkAncestor(td, DEFAULT_CONFIG)).toBe(true)
  })

  it("applies user rules on any site", () => {
    setHost("my-blog.example.org")

    const config = configWithSiteRules({
      userRules: [
        { id: "my-blog", matches: "my-blog.example.org", excludeSelectors: [".comments"] },
      ],
      disabledBuiltInRules: [],
    })

    const comments = document.createElement("div")
    comments.classList.add("comments")
    document.body.appendChild(comments)

    expect(isSiteRuleExcludedElement(comments, config)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(comments, config)).toBe(true)
  })

  it("stops matching when the built-in rule is disabled", () => {
    setHost("chatgpt.com")

    const config = configWithSiteRules({
      userRules: [],
      disabledBuiltInRules: ["readfrog-chatgpt", "chatOpenai"],
    })

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")
    document.body.appendChild(proseMirror)

    expect(isSiteRuleExcludedElement(proseMirror, config)).toBe(false)
  })
})
