// @vitest-environment jsdom
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
})
