import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { isSiteEnabled } from "../site-control"

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
