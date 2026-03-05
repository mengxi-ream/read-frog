// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildSectionSearch,
  getSectionIdFromSearch,
  scrollToSectionWhenReady,
} from "../section-scroll"

const mockedWaitForElement = vi.hoisted(() => vi.fn())

vi.mock("@/utils/dom/wait-for-element", () => ({
  waitForElement: mockedWaitForElement,
}))

describe("section-scroll", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    mockedWaitForElement.mockReset()
  })

  it("builds and parses section query params", () => {
    const search = buildSectionSearch("request-rate")
    expect(search).toBe("?section=request-rate")
    expect(getSectionIdFromSearch(search)).toBe("request-rate")
  })

  it("ignores missing or blank section params", () => {
    expect(getSectionIdFromSearch("")).toBeNull()
    expect(getSectionIdFromSearch("?foo=bar")).toBeNull()
    expect(getSectionIdFromSearch("?section=")).toBeNull()
    expect(getSectionIdFromSearch("?section=%20%20")).toBeNull()
  })

  it("scrolls immediately when section already exists", async () => {
    const section = document.createElement("section")
    section.id = "request-rate"
    document.body.appendChild(section)

    const scrollIntoViewSpy = vi.fn()
    Object.defineProperty(section, "scrollIntoView", {
      value: scrollIntoViewSpy,
      configurable: true,
    })

    const didScroll = await scrollToSectionWhenReady("request-rate")

    expect(didScroll).toBe(true)
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" })
    expect(mockedWaitForElement).not.toHaveBeenCalled()
  })

  it("waits for section mount when section is not yet in the DOM", async () => {
    const delayedSection = document.createElement("section")
    delayedSection.id = "request-rate"
    const scrollIntoViewSpy = vi.fn()
    Object.defineProperty(delayedSection, "scrollIntoView", {
      value: scrollIntoViewSpy,
      configurable: true,
    })
    mockedWaitForElement.mockResolvedValueOnce(delayedSection)

    const didScroll = await scrollToSectionWhenReady("request-rate")

    expect(didScroll).toBe(true)
    expect(mockedWaitForElement).toHaveBeenCalledWith(expect.stringContaining("request-rate"))
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" })
  })

  it("returns false when section never appears", async () => {
    mockedWaitForElement.mockResolvedValueOnce(null)

    const didScroll = await scrollToSectionWhenReady("missing-section")

    expect(didScroll).toBe(false)
  })
})
