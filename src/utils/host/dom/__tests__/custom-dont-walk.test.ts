// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { hasNoWalkAncestor, isCustomDontWalkIntoElement, isDontWalkIntoAndDontTranslateAsChildElement } from "../filter"

function setHost(host: string) {
  // jsdom exposes location as read-only; override via defineProperty
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/some/path`),
    writable: true,
  })
}

describe("isCustomDontWalkIntoElement", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("loads rules and identifies elements on configured host", () => {
    setHost("chatgpt.com")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")
    document.body.appendChild(proseMirror)

    expect(isCustomDontWalkIntoElement(proseMirror)).toBe(true)
    // integration via filter.ts
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
  })

  it("does not match on non-configured host", () => {
    setHost("example.com")

    const el = document.createElement("div")
    document.body.appendChild(el)

    expect(isCustomDontWalkIntoElement(el)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(el, DEFAULT_CONFIG)).toBe(false)
  })

  it("only matches configured element when multiple nodes present on chatgpt.com", () => {
    setHost("chatgpt.com")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")

    const other = document.createElement("div")

    document.body.appendChild(proseMirror)
    document.body.appendChild(other)

    expect(isCustomDontWalkIntoElement(proseMirror)).toBe(true)
    expect(isCustomDontWalkIntoElement(other)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("uses hostname when host includes port (host !== hostname)", () => {
    setHost("chatgpt.com:3000")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")

    const other = document.createElement("div")

    document.body.appendChild(proseMirror)
    document.body.appendChild(other)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("chatgpt.com")

    expect(isCustomDontWalkIntoElement(proseMirror)).toBe(true)
    expect(isCustomDontWalkIntoElement(other)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("does not match on non-configured host when host !== hostname", () => {
    setHost("example.com:8080")

    const proseMirror = document.createElement("div")
    proseMirror.classList.add("ProseMirror")

    const other = document.createElement("div")

    document.body.appendChild(proseMirror)
    document.body.appendChild(other)

    expect(window.location.host).toContain(":")
    expect(window.location.hostname).toBe("example.com")

    expect(isCustomDontWalkIntoElement(proseMirror)).toBe(false)
    expect(isCustomDontWalkIntoElement(other)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(proseMirror, DEFAULT_CONFIG)).toBe(false)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(other, DEFAULT_CONFIG)).toBe(false)
  })

  it("matches shreddit-post-flair element on www.reddit.com", () => {
    setHost("www.reddit.com")

    const postFlair = document.createElement("shreddit-post-flair")
    document.body.appendChild(postFlair)

    expect(isCustomDontWalkIntoElement(postFlair)).toBe(true)
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

    expect(isCustomDontWalkIntoElement(diffTable)).toBe(true)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(diffTable, DEFAULT_CONFIG)).toBe(true)
    expect(hasNoWalkAncestor(td, DEFAULT_CONFIG)).toBe(true)
  })
})
