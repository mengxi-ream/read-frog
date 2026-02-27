import { describe, expect, it } from "vitest"
import { matchDomainPattern } from "../url"

describe("matchDomainPattern", () => {
  describe("exact domain match", () => {
    it("should match exact domain with https", () => {
      const result = matchDomainPattern("https://x.com", "x.com")
      expect(result).toBe(true)
    })

    it("should match exact domain with http", () => {
      const result = matchDomainPattern("http://example.com", "example.com")
      expect(result).toBe(true)
    })

    it("should match exact domain with path", () => {
      const result = matchDomainPattern("https://x.com/path/to/page", "x.com")
      expect(result).toBe(true)
    })

    it("should match exact domain with query parameters", () => {
      const result = matchDomainPattern("https://example.com?query=value", "example.com")
      expect(result).toBe(true)
    })

    it("should match exact domain with port", () => {
      const result = matchDomainPattern("http://localhost:3000", "localhost")
      expect(result).toBe(true)
    })

    it("should be case insensitive for domain matching", () => {
      const result = matchDomainPattern("https://Example.COM", "example.com")
      expect(result).toBe(true)
    })

    it("should handle pattern with extra whitespace", () => {
      const result = matchDomainPattern("https://x.com", "  x.com  ")
      expect(result).toBe(true)
    })
  })

  describe("subdomain matching", () => {
    it("should match subdomain with single level", () => {
      const result = matchDomainPattern("https://www.x.com", "x.com")
      expect(result).toBe(true)
    })

    it("should match subdomain with multiple levels", () => {
      const result = matchDomainPattern("https://api.dev.example.com", "example.com")
      expect(result).toBe(true)
    })

    it("should match subdomain with path", () => {
      const result = matchDomainPattern("https://blog.example.com/article", "example.com")
      expect(result).toBe(true)
    })

    it("should match subdomain case insensitively", () => {
      const result = matchDomainPattern("https://API.Example.COM", "example.com")
      expect(result).toBe(true)
    })
  })

  describe("non-matching domains", () => {
    it("should not match different domain", () => {
      const result = matchDomainPattern("https://example.com", "x.com")
      expect(result).toBe(false)
    })

    it("should not match domain as substring", () => {
      const result = matchDomainPattern("https://notx.com", "x.com")
      expect(result).toBe(false)
    })

    it("should not match domain suffix without dot separator", () => {
      const result = matchDomainPattern("https://ax.com", "x.com")
      expect(result).toBe(false)
    })

    it("should not match similar TLD (x.com vs x.co)", () => {
      const result = matchDomainPattern("https://x.com", "x.co")
      expect(result).toBe(false)
    })

    it("should not match when pattern is longer than hostname", () => {
      const result = matchDomainPattern("https://x.com", "www.x.com")
      expect(result).toBe(false)
    })

    it("should not match superdomain", () => {
      const result = matchDomainPattern("https://x.com", "www.x.com")
      expect(result).toBe(false)
    })
  })

  describe("invalid URLs", () => {
    it("should return false for empty string", () => {
      const result = matchDomainPattern("", "x.com")
      expect(result).toBe(false)
    })

    it("should return false for malformed URL", () => {
      const result = matchDomainPattern("not-a-url", "x.com")
      expect(result).toBe(false)
    })

    it("should return false for relative path", () => {
      const result = matchDomainPattern("/path/to/page", "x.com")
      expect(result).toBe(false)
    })

    it("should return false for URL without protocol", () => {
      const result = matchDomainPattern("example.com", "example.com")
      expect(result).toBe(false)
    })

    it("should return false for malformed URL with spaces", () => {
      const result = matchDomainPattern("https://example .com", "example.com")
      expect(result).toBe(false)
    })

    it("should return false for undefined as string", () => {
      const result = matchDomainPattern("undefined", "x.com")
      expect(result).toBe(false)
    })

    it("should return false for null as string", () => {
      const result = matchDomainPattern("null", "x.com")
      expect(result).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("should handle URL with fragment", () => {
      const result = matchDomainPattern("https://x.com#section", "x.com")
      expect(result).toBe(true)
    })

    it("should handle URL with credentials", () => {
      const result = matchDomainPattern("https://user:pass@example.com", "example.com")
      expect(result).toBe(true)
    })

    it("should handle localhost", () => {
      const result = matchDomainPattern("http://localhost", "localhost")
      expect(result).toBe(true)
    })

    it("should handle IP address", () => {
      const result = matchDomainPattern("http://192.168.1.1", "192.168.1.1")
      expect(result).toBe(true)
    })

    it("should handle IPv6 address", () => {
      const result = matchDomainPattern("http://[::1]", "[::1]")
      expect(result).toBe(true)
    })

    it("should handle domain with hyphen", () => {
      const result = matchDomainPattern("https://my-domain.com", "my-domain.com")
      expect(result).toBe(true)
    })

    it("should handle domain with numbers", () => {
      const result = matchDomainPattern("https://example123.com", "example123.com")
      expect(result).toBe(true)
    })

    it("should handle long TLD", () => {
      const result = matchDomainPattern("https://example.technology", "example.technology")
      expect(result).toBe(true)
    })

    it("should handle country code TLD", () => {
      const result = matchDomainPattern("https://example.co.uk", "example.co.uk")
      expect(result).toBe(true)
    })

    it("should match country code TLD as pattern", () => {
      const result = matchDomainPattern("https://example.co.uk", "co.uk")
      expect(result).toBe(true)
    })
  })

  describe("real-world examples", () => {
    it("should match Twitter/X domain", () => {
      const result = matchDomainPattern("https://x.com/user/status/123", "x.com")
      expect(result).toBe(true)
    })

    it("should match GitHub domain", () => {
      const result = matchDomainPattern("https://github.com/user/repo", "github.com")
      expect(result).toBe(true)
    })

    it("should match GitHub subdomain", () => {
      const result = matchDomainPattern("https://gist.github.com/user/123", "github.com")
      expect(result).toBe(true)
    })

    it("should not match similar but different domain", () => {
      const result = matchDomainPattern("https://mygithub.com", "github.com")
      expect(result).toBe(false)
    })

    it("should handle Wikipedia with language subdomain", () => {
      const result = matchDomainPattern("https://en.wikipedia.org/wiki/Article", "wikipedia.org")
      expect(result).toBe(true)
    })
  })
})
