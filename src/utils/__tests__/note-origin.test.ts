// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import {
  clearAppliedDocumentTitleTranslation,
  setAppliedDocumentTitleTranslation,
} from "@/utils/content/document-title"
import { getEbookNoteOrigin, getVideoNoteOrigin, getWebPageNoteOrigin } from "../note-origin"

const EBOOK_ID = "33333333-3333-4333-8333-333333333333"

describe("getWebPageNoteOrigin", () => {
  it("records an http(s) page with its trimmed title", () => {
    expect(
      getWebPageNoteOrigin({ href: "https://example.com/a?b=1#c", title: "  An article \n" }),
    ).toEqual({ kind: "webpage", url: "https://example.com/a?b=1#c", title: "An article" })
  })

  it("leaves out an empty title", () => {
    expect(getWebPageNoteOrigin({ href: "https://example.com/", title: "   " })).toEqual({
      kind: "webpage",
      url: "https://example.com/",
    })
  })

  it("records readfrog.app pages such as the guide like any other page", () => {
    expect(
      getWebPageNoteOrigin({ href: "https://readfrog.app/guide/step-1", title: "Guide" }),
    ).toEqual({ kind: "webpage", url: "https://readfrog.app/guide/step-1", title: "Guide" })
  })

  it("strips credential query parameters", () => {
    const origin = getWebPageNoteOrigin({
      href: "https://example.com/doc?token=secret&page=2",
      title: "Doc",
    })
    expect(origin?.kind).toBe("webpage")
    expect(origin && "url" in origin ? origin.url : "").not.toContain("secret")
  })

  it.each([
    "chrome-extension://abcdefghijklmnop/translation-hub.html",
    "moz-extension://1234/options.html",
    "file:///Users/reader/book.html",
    "about:blank",
    "",
  ])("gives no origin for %s", (href) => {
    expect(getWebPageNoteOrigin({ href, title: "Page" })).toBeNull()
  })
})

describe("getEbookNoteOrigin", () => {
  it("records the book and the selection's CFI from the reader", () => {
    expect(getEbookNoteOrigin({ ebookId: EBOOK_ID, cfi: "epubcfi(/6/4!/4/2/1:0)" })).toEqual({
      kind: "ebook",
      ebookId: EBOOK_ID,
      cfi: "epubcfi(/6/4!/4/2/1:0)",
    })
  })

  it("records the book without a CFI when the reader sends none", () => {
    expect(getEbookNoteOrigin({ ebookId: EBOOK_ID })).toEqual({ kind: "ebook", ebookId: EBOOK_ID })
  })

  it("gives no origin when an older reader does not say which book", () => {
    expect(getEbookNoteOrigin({ cfi: "epubcfi(/6/4)" })).toBeNull()
  })

  it("gives no origin for a book id that is not one", () => {
    expect(getEbookNoteOrigin({ ebookId: "book-1" })).toBeNull()
  })
})

describe("getVideoNoteOrigin", () => {
  const page = { href: "https://www.youtube.com/watch?v=abc", title: "A talk - YouTube" }

  it("records the video page", () => {
    expect(getVideoNoteOrigin({}, page)).toEqual({
      kind: "video",
      url: "https://www.youtube.com/watch?v=abc",
      title: "A talk - YouTube",
    })
  })

  it("records the playing time when known", () => {
    expect(getVideoNoteOrigin({ seconds: 83.5 }, page)).toMatchObject({
      kind: "video",
      seconds: 83.5,
    })
  })

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])("leaves out a time of %s", (seconds) => {
    expect(getVideoNoteOrigin({ seconds }, page)).not.toHaveProperty("seconds")
  })

  it("links to the platform's video, without the page's title, when the page URL does not name it", () => {
    expect(
      getVideoNoteOrigin(
        { seconds: 7, videoPageUrl: "https://x.com/i/status/1234567890" },
        { href: "https://x.com/home", title: "Home / X" },
      ),
    ).toEqual({ kind: "video", url: "https://x.com/i/status/1234567890", seconds: 7 })
  })

  it("falls back to the page when the platform has no link for the video", () => {
    expect(getVideoNoteOrigin({ videoPageUrl: null }, page)).toMatchObject({
      url: "https://www.youtube.com/watch?v=abc",
    })
  })

  it("gives no origin off http(s)", () => {
    expect(getVideoNoteOrigin({ seconds: 1 }, { href: "file:///movie.html", title: "" })).toBeNull()
  })
})

describe("the current page's title", () => {
  afterEach(() => {
    clearAppliedDocumentTitleTranslation()
    document.title = ""
  })

  it("is the page's own title, not the one page translation wrote over it", () => {
    document.title = "青蛙的生活"
    setAppliedDocumentTitleTranslation("The life of frogs", "青蛙的生活")

    expect(getWebPageNoteOrigin()).toMatchObject({ title: "The life of frogs" })
    expect(getVideoNoteOrigin()).toMatchObject({ title: "The life of frogs" })
  })

  it("is the title the page set itself after a translation", () => {
    setAppliedDocumentTitleTranslation("The life of frogs", "青蛙的生活")
    document.title = "A newer title"

    expect(getWebPageNoteOrigin()).toMatchObject({ title: "A newer title" })
  })
})
