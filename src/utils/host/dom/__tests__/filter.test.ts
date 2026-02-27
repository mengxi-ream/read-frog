// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"

import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_CONTENT_CLASS,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from "@/utils/constants/dom-labels"

import { isDontWalkIntoAndDontTranslateAsChildElement, isDontWalkIntoButTranslateAsChildElement, isTranslatedContentNode } from "../filter"

describe("isTranslatedContentNode", () => {
  it("should return true for block translated content", () => {
    const element = document.createElement("span")
    element.className = BLOCK_CONTENT_CLASS
    expect(isTranslatedContentNode(element)).toBe(true)
  })

  it("should return true for inline translated content", () => {
    const element = document.createElement("span")
    element.className = INLINE_CONTENT_CLASS
    expect(isTranslatedContentNode(element)).toBe(true)
  })

  it("should return false for non-translated content", () => {
    const element = document.createElement("div")
    element.className = "some-other-class"
    expect(isTranslatedContentNode(element)).toBe(false)
  })

  it("should return false for text nodes", () => {
    const textNode = document.createTextNode("text")
    expect(isTranslatedContentNode(textNode)).toBe(false)
  })

  it("should return true for elements with both classes", () => {
    const element = document.createElement("span")
    element.className = `${BLOCK_CONTENT_CLASS} ${INLINE_CONTENT_CLASS}`
    expect(isTranslatedContentNode(element)).toBe(true)
  })
})

describe("isDontWalkIntoButTranslateAsChildElement", () => {
  it("should return true for notranslate class", () => {
    const element = document.createElement("span")
    element.classList.add(NOTRANSLATE_CLASS)
    expect(isDontWalkIntoButTranslateAsChildElement(element)).toBe(true)
  })

  it("should return true for CODE tag", () => {
    const element = document.createElement("code")
    expect(isDontWalkIntoButTranslateAsChildElement(element)).toBe(true)
  })

  it("should return false for sr-only class", () => {
    const element = document.createElement("span")
    element.classList.add("sr-only")
    expect(isDontWalkIntoButTranslateAsChildElement(element)).toBe(false)
  })

  it("should return false for visually-hidden class", () => {
    const element = document.createElement("span")
    element.classList.add("visually-hidden")
    expect(isDontWalkIntoButTranslateAsChildElement(element)).toBe(false)
  })

  it("should return false for regular elements", () => {
    const element = document.createElement("div")
    expect(isDontWalkIntoButTranslateAsChildElement(element)).toBe(false)
  })
})

function createConfig(range: "main" | "all"): Config {
  return { translate: { page: { range } } } as unknown as Config
}

describe("isDontWalkIntoAndDontTranslateAsChildElement", () => {
  it("should return true for sr-only class", () => {
    const element = document.createElement("span")
    element.classList.add("sr-only")
    expect(isDontWalkIntoAndDontTranslateAsChildElement(element, DEFAULT_CONFIG)).toBe(true)
  })

  it("should return true for visually-hidden class", () => {
    const element = document.createElement("span")
    element.classList.add("visually-hidden")
    expect(isDontWalkIntoAndDontTranslateAsChildElement(element, DEFAULT_CONFIG)).toBe(true)
  })

  it("should return true for aria-hidden=\"true\"", () => {
    const element = document.createElement("div")
    element.setAttribute("aria-hidden", "true")
    expect(isDontWalkIntoAndDontTranslateAsChildElement(element, DEFAULT_CONFIG)).toBe(true)
  })

  it("should return true for SCRIPT tag", () => {
    const element = document.createElement("script")
    expect(isDontWalkIntoAndDontTranslateAsChildElement(element, DEFAULT_CONFIG)).toBe(true)
  })

  it("should return false for regular elements", () => {
    const element = document.createElement("div")
    expect(isDontWalkIntoAndDontTranslateAsChildElement(element, DEFAULT_CONFIG)).toBe(false)
  })

  it("should skip top-level <header> in main mode", () => {
    const header = document.createElement("header")
    document.body.appendChild(header)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(header, createConfig("main"))).toBe(true)
    document.body.removeChild(header)
  })

  it("should NOT skip <header> inside <article> in main mode", () => {
    const article = document.createElement("article")
    const header = document.createElement("header")
    article.appendChild(header)
    document.body.appendChild(article)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(header, createConfig("main"))).toBe(false)
    document.body.removeChild(article)
  })

  it("should NOT skip <header> inside <main> in main mode", () => {
    const main = document.createElement("main")
    const header = document.createElement("header")
    main.appendChild(header)
    document.body.appendChild(main)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(header, createConfig("main"))).toBe(false)
    document.body.removeChild(main)
  })

  it("should NOT skip any <header> in all mode", () => {
    const header = document.createElement("header")
    document.body.appendChild(header)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(header, createConfig("all"))).toBe(false)
    document.body.removeChild(header)
  })

  it("should NOT skip <header> deeply nested inside <article> in main mode", () => {
    const article = document.createElement("article")
    const div = document.createElement("div")
    const header = document.createElement("header")
    div.appendChild(header)
    article.appendChild(div)
    document.body.appendChild(article)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(header, createConfig("main"))).toBe(false)
    document.body.removeChild(article)
  })

  it("should skip top-level <footer> in main mode", () => {
    const footer = document.createElement("footer")
    document.body.appendChild(footer)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(footer, createConfig("main"))).toBe(true)
    document.body.removeChild(footer)
  })

  it("should NOT skip <footer> inside <article> in main mode", () => {
    const article = document.createElement("article")
    const footer = document.createElement("footer")
    article.appendChild(footer)
    document.body.appendChild(article)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(footer, createConfig("main"))).toBe(false)
    document.body.removeChild(article)
  })

  it("should skip top-level <nav> in main mode", () => {
    const nav = document.createElement("nav")
    document.body.appendChild(nav)
    expect(isDontWalkIntoAndDontTranslateAsChildElement(nav, createConfig("main"))).toBe(true)
    document.body.removeChild(nav)
  })
})
