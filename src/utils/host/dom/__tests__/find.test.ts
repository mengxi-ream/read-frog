// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
} from "@/utils/constants/dom-labels"
import { findTranslatedContentWrapper, unwrapDeepestOnlyHTMLChild } from "../find"

vi.mock("@/utils/config/storage", async () => {
  const { DEFAULT_CONFIG } = await import("@/utils/constants/config")
  return {
    getLocalConfig: vi.fn(async () => DEFAULT_CONFIG),
  }
})

describe("findTranslatedContentWrapper", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("should find nearest wrapper for block translated content", () => {
    const wrapper = document.createElement("span")
    wrapper.className = CONTENT_WRAPPER_CLASS

    const parent = document.createElement("div")
    parent.appendChild(wrapper)

    const translatedContent = document.createElement("span")
    translatedContent.className = BLOCK_CONTENT_CLASS
    wrapper.appendChild(translatedContent)

    document.body.appendChild(parent)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(wrapper)
  })

  it("should find nearest wrapper for inline translated content", () => {
    const wrapper = document.createElement("span")
    wrapper.className = CONTENT_WRAPPER_CLASS

    const translatedContent = document.createElement("span")
    translatedContent.className = INLINE_CONTENT_CLASS
    wrapper.appendChild(translatedContent)

    document.body.appendChild(wrapper)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(wrapper)
  })

  it("should return null for non-translated content", () => {
    const element = document.createElement("div")
    element.className = "not-translated"

    const result = findTranslatedContentWrapper(element)
    expect(result).toBe(null)
  })

  it("should return null if no wrapper found", () => {
    const translatedContent = document.createElement("span")
    translatedContent.className = BLOCK_CONTENT_CLASS
    document.body.appendChild(translatedContent)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(null)
  })

  it("should find wrapper through multiple parent levels", () => {
    const wrapper = document.createElement("span")
    wrapper.className = CONTENT_WRAPPER_CLASS

    const middleParent = document.createElement("div")
    const immediateParent = document.createElement("p")

    const translatedContent = document.createElement("span")
    translatedContent.className = BLOCK_CONTENT_CLASS

    // Structure: wrapper > middleParent > immediateParent > translatedContent
    wrapper.appendChild(middleParent)
    middleParent.appendChild(immediateParent)
    immediateParent.appendChild(translatedContent)

    document.body.appendChild(wrapper)

    const result = findTranslatedContentWrapper(translatedContent)
    expect(result).toBe(wrapper)
  })
})

describe("unwrapDeepestOnlyHTMLChild", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/some/path"),
      writable: true,
    })
  })

  it("unwraps nested single-child elements without mutating truncation styles", async () => {
    const outer = document.createElement("div")
    outer.style.webkitLineClamp = "2"
    outer.style.maxHeight = "24px"
    outer.style.textOverflow = "ellipsis"

    const middle = document.createElement("div")
    middle.style.webkitLineClamp = "3"
    middle.style.maxHeight = "32px"
    middle.style.textOverflow = "ellipsis"

    const leaf = document.createElement("span")
    leaf.textContent = "Nested text"

    middle.appendChild(leaf)
    outer.appendChild(middle)
    document.body.appendChild(outer)

    await expect(unwrapDeepestOnlyHTMLChild(outer)).resolves.toBe(leaf)

    expect(outer.style.webkitLineClamp).toBe("2")
    expect(outer.style.maxHeight).toBe("24px")
    expect(outer.style.textOverflow).toBe("ellipsis")
    expect(middle.style.webkitLineClamp).toBe("3")
    expect(middle.style.maxHeight).toBe("32px")
    expect(middle.style.textOverflow).toBe("ellipsis")
  })
})
