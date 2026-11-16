import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { isFrameSiteEnabled, isSiteEnabled, resolveEffectiveSiteControlUrl } from "../site-control"

function createConfig(siteControl: Config["siteControl"]): Config {
  return { siteControl } as Config
}

describe("isSiteEnabled", () => {
  it("should return true when config is null", () => {
    expect(isSiteEnabled("https://example.com", null)).toBe(true)
  })

  describe("blacklist mode", () => {
    it("should return true when URL is not in blacklist", () => {
      const config = createConfig({
        mode: "blacklist",
        blacklistPatterns: ["blocked.com"],
        whitelistPatterns: [],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(true)
    })

    it("should return false when URL is in blacklist", () => {
      const config = createConfig({
        mode: "blacklist",
        blacklistPatterns: ["example.com"],
        whitelistPatterns: [],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(false)
    })

    it("should ignore whitelistPatterns in blacklist mode", () => {
      const config = createConfig({
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: ["example.com"],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(true)
    })
  })

  describe("whitelist mode", () => {
    it("should return true when URL is in whitelist", () => {
      const config = createConfig({
        mode: "whitelist",
        blacklistPatterns: [],
        whitelistPatterns: ["example.com"],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(true)
    })

    it("should return false when URL is not in whitelist", () => {
      const config = createConfig({
        mode: "whitelist",
        blacklistPatterns: [],
        whitelistPatterns: ["other.com"],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(false)
    })

    it("should return false when whitelist is empty", () => {
      const config = createConfig({
        mode: "whitelist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(false)
    })

    it("should ignore blacklistPatterns in whitelist mode", () => {
      const config = createConfig({
        mode: "whitelist",
        blacklistPatterns: ["example.com"],
        whitelistPatterns: ["example.com"],
      })
      expect(isSiteEnabled("https://example.com", config)).toBe(true)
    })
  })
})

describe("isFrameSiteEnabled", () => {
  const EDX_COURSE_PAGE = "https://learning.edx.org/course/course-v1:edX+DemoX+Demo_Course/home"
  const EDX_VIDEO_FRAME =
    "https://courses.edx.org/xblock/block-v1:edX+DemoX+Demo_Course+type@vertical+block@intro"
  const YOUTUBE_EMBED = "https://www.youtube.com/embed/aqz-KE-bpKQ"
  const BLOG_PAGE = "https://blog.example/post"

  it("runs a frame from another site in a page listed in whitelist mode", () => {
    // What the popup lists on an edX course page
    const config = createConfig({
      mode: "whitelist",
      blacklistPatterns: [],
      whitelistPatterns: ["*.learning.edx.org"],
    })
    expect(isFrameSiteEnabled(EDX_VIDEO_FRAME, EDX_COURSE_PAGE, config)).toBe(true)
  })

  it("keeps a frame off in a page not listed in whitelist mode, though its own site is", () => {
    const config = createConfig({
      mode: "whitelist",
      blacklistPatterns: [],
      whitelistPatterns: ["*.youtube.com"],
    })
    expect(isFrameSiteEnabled(YOUTUBE_EMBED, BLOG_PAGE, config)).toBe(false)
  })

  it("keeps a frame off in a page disabled in blacklist mode", () => {
    const config = createConfig({
      mode: "blacklist",
      blacklistPatterns: ["*.blog.example"],
      whitelistPatterns: [],
    })
    expect(isFrameSiteEnabled(YOUTUBE_EMBED, BLOG_PAGE, config)).toBe(false)
  })

  it("keeps a frame from a site disabled in blacklist mode off in any page", () => {
    const config = createConfig({
      mode: "blacklist",
      blacklistPatterns: ["*.youtube.com"],
      whitelistPatterns: [],
    })
    expect(isFrameSiteEnabled(YOUTUBE_EMBED, BLOG_PAGE, config)).toBe(false)
  })

  it("runs a frame when neither its site nor the page's is disabled", () => {
    const config = createConfig({
      mode: "blacklist",
      blacklistPatterns: ["*.other.example"],
      whitelistPatterns: [],
    })
    expect(isFrameSiteEnabled(YOUTUBE_EMBED, BLOG_PAGE, config)).toBe(true)
    expect(isFrameSiteEnabled(YOUTUBE_EMBED, BLOG_PAGE, null)).toBe(true)
  })
})

describe("resolveEffectiveSiteControlUrl", () => {
  it("prefers the injected ancestor URL when provided", () => {
    expect(resolveEffectiveSiteControlUrl("about:blank", "https://allowed.com/frame")).toBe(
      "https://allowed.com/frame",
    )
  })

  it("falls back to the current frame URL when no injected override exists", () => {
    expect(resolveEffectiveSiteControlUrl("https://example.com/app")).toBe(
      "https://example.com/app",
    )
  })

  it("lets whitelist mode honor an allowed ancestor for blank iframes", () => {
    const config = createConfig({
      mode: "whitelist",
      blacklistPatterns: [],
      whitelistPatterns: ["allowed.com"],
    })

    const effectiveUrl = resolveEffectiveSiteControlUrl("about:blank", "https://allowed.com/frame")
    expect(isSiteEnabled(effectiveUrl, config)).toBe(true)
  })

  it("lets blacklist mode block a disabled ancestor for blank iframes", () => {
    const config = createConfig({
      mode: "blacklist",
      blacklistPatterns: ["blocked.com"],
      whitelistPatterns: [],
    })

    const effectiveUrl = resolveEffectiveSiteControlUrl("about:srcdoc", "https://blocked.com/embed")
    expect(isSiteEnabled(effectiveUrl, config)).toBe(false)
  })
})
