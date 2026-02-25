// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isCustomDontWalkIntoElement, isDontWalkIntoAndDontTranslateAsChildElement } from "../filter"

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
})
