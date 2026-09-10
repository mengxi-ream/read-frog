import { describe, expect, it } from "vitest"
import { areSamePageTranslationOrigin, getPageTranslationOriginScope } from "../url"

describe("page translation origin scope", () => {
  it("uses origin for http and https URLs", () => {
    expect(getPageTranslationOriginScope("https://example.com/articles/1")).toBe(
      "https://example.com",
    )
    expect(getPageTranslationOriginScope("http://localhost:3000/path")).toBe(
      "http://localhost:3000",
    )
  })

  it("keeps query and hash changes in the same origin scope", () => {
    expect(
      areSamePageTranslationOrigin(
        "https://example.com/articles/1?tab=a#top",
        "https://example.com/articles/2?tab=b#comments",
      ),
    ).toBe(true)
  })

  it("treats protocol, hostname, and port changes as different sites", () => {
    expect(areSamePageTranslationOrigin("https://example.com/a", "http://example.com/a")).toBe(
      false,
    )
    expect(areSamePageTranslationOrigin("https://example.com/a", "https://www.example.com/a")).toBe(
      false,
    )
    expect(areSamePageTranslationOrigin("http://localhost:3000/a", "http://localhost:3001/a")).toBe(
      false,
    )
  })

  it("does not create a broad persistent scope for file or invalid URLs", () => {
    expect(getPageTranslationOriginScope("file:///Users/example/page.html")).toBeNull()
    expect(getPageTranslationOriginScope("not-a-url")).toBeNull()
    expect(
      areSamePageTranslationOrigin("file:///Users/example/a.html", "file:///Users/example/b.html"),
    ).toBe(false)
  })
})
