import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { isSiteEnabled, resolveEffectiveSiteControlUrl } from "../site-control"

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

describe("resolveEffectiveSiteControlUrl", () => {
  it("prefers the injected ancestor URL when provided", () => {
    expect(resolveEffectiveSiteControlUrl("about:blank", "https://allowed.com/frame")).toBe(
      "https://allowed.com/frame",
    )
  })

  it("falls back to the current frame URL when no injected override exists", () => {
    expect(resolveEffectiveSiteControlUrl("https://example.com/app")).toBe("https://example.com/app")
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
