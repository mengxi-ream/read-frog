import { describe, expect, it } from "vitest"
import { normalizeUrlPattern, urlMatchesPattern, urlMatchesRule } from "../match"

describe("normalizeUrlPattern", () => {
  it("expands bare hostnames", () => {
    expect(normalizeUrlPattern("github.com")).toBe("*://github.com/*")
  })

  it("expands subdomain wildcards", () => {
    expect(normalizeUrlPattern("*.example.com")).toBe("*://*.example.com/*")
  })

  it("keeps paths verbatim", () => {
    expect(normalizeUrlPattern("github.com/settings")).toBe("*://github.com/settings")
    expect(normalizeUrlPattern("developer.apple.com/documentation/*")).toBe(
      "*://developer.apple.com/documentation/*",
    )
  })

  it("appends /* when a scheme is given without a path", () => {
    expect(normalizeUrlPattern("https://example.com")).toBe("https://example.com/*")
  })

  it("passes full match patterns through", () => {
    expect(normalizeUrlPattern("*://x.com/*")).toBe("*://x.com/*")
    expect(normalizeUrlPattern("https://www.npmjs.com/package/*")).toBe(
      "https://www.npmjs.com/package/*",
    )
  })

  it("lowercases scheme and host but not the path", () => {
    expect(normalizeUrlPattern("HTTPS://Example.COM/Path")).toBe("https://example.com/Path")
  })

  it("trims whitespace", () => {
    expect(normalizeUrlPattern("  github.com  ")).toBe("*://github.com/*")
  })

  it("allows the all-hosts wildcard", () => {
    expect(normalizeUrlPattern("*")).toBe("*://*/*")
  })

  it("keeps TLD and mid-host wildcards", () => {
    expect(normalizeUrlPattern("www.amazon.*")).toBe("*://www.amazon.*/*")
    expect(normalizeUrlPattern("javdb*.com")).toBe("*://javdb*.com/*")
  })

  it("rejects unsupported input", () => {
    expect(normalizeUrlPattern("")).toBeNull()
    expect(normalizeUrlPattern("   ")).toBeNull()
    expect(normalizeUrlPattern("example.com:8080")).toBeNull()
    expect(normalizeUrlPattern("file:///etc/hosts")).toBeNull()
    expect(normalizeUrlPattern("ftp://example.com")).toBeNull()
  })
})

describe("urlMatchesPattern", () => {
  it("matches the exact host for bare hostnames, excluding subdomains", () => {
    expect(urlMatchesPattern("https://github.com/foo", "github.com")).toBe(true)
    expect(urlMatchesPattern("http://github.com/", "github.com")).toBe(true)
    expect(urlMatchesPattern("https://gist.github.com/foo", "github.com")).toBe(false)
  })

  it("matches apex and subdomains for *. patterns", () => {
    expect(urlMatchesPattern("https://example.com/", "*.example.com")).toBe(true)
    expect(urlMatchesPattern("https://sub.example.com/x", "*.example.com")).toBe(true)
    expect(urlMatchesPattern("https://deep.sub.example.com/x", "*.example.com")).toBe(true)
    expect(urlMatchesPattern("https://notexample.com/", "*.example.com")).toBe(false)
  })

  it("supports mid-path wildcards", () => {
    expect(urlMatchesPattern("https://github.com/a/b/settings", "github.com/*/settings")).toBe(true)
    expect(urlMatchesPattern("https://github.com/a/b", "github.com/*/settings")).toBe(false)
  })

  it("ignores query strings", () => {
    expect(urlMatchesPattern("https://github.com/foo?tab=readme", "github.com/foo")).toBe(true)
  })

  it("matches any TLD for trailing .* wildcards", () => {
    expect(urlMatchesPattern("https://www.amazon.com/dp/1", "www.amazon.*")).toBe(true)
    expect(urlMatchesPattern("https://www.amazon.co.jp/dp/1", "www.amazon.*")).toBe(true)
    expect(urlMatchesPattern("https://www.amazonaws.com/", "www.amazon.*")).toBe(false)
    expect(
      urlMatchesPattern("https://scholar.google.co.uk/scholar?q=x", "scholar.google.*/*"),
    ).toBe(true)
  })

  it("matches apex and subdomains for patterns with both leading and trailing wildcards", () => {
    expect(urlMatchesPattern("https://weibo.com/u/1", "*.weibo.*")).toBe(true)
    expect(urlMatchesPattern("https://m.weibo.cn/detail/2", "*.weibo.*")).toBe(true)
    expect(urlMatchesPattern("https://notweibo.com/", "*.weibo.*")).toBe(false)
  })

  it("matches mid-host wildcards", () => {
    expect(urlMatchesPattern("https://javdb007.com/x", "javdb*.com")).toBe(true)
    expect(urlMatchesPattern("https://javdb.com/x", "javdb*.com")).toBe(true)
    expect(urlMatchesPattern("https://example.com/", "javdb*.com")).toBe(false)
  })

  it("restricts wildcard-host patterns to http(s) and ignores query strings", () => {
    expect(urlMatchesPattern("ftp://www.amazon.com/", "www.amazon.*")).toBe(false)
    expect(urlMatchesPattern("https://www.amazon.de/dp/1?ref=nav", "www.amazon.*/dp/*")).toBe(true)
  })

  it("returns false for URLs it cannot handle instead of throwing", () => {
    expect(urlMatchesPattern("not a url", "github.com")).toBe(false)
    expect(urlMatchesPattern("not a url", "www.amazon.*")).toBe(false)
    expect(urlMatchesPattern("file:///etc/hosts", "github.com")).toBe(false)
    expect(urlMatchesPattern("about:blank", "github.com")).toBe(false)
  })

  it("returns false for invalid patterns instead of throwing", () => {
    expect(urlMatchesPattern("https://github.com/", "example.com:8080")).toBe(false)
    expect(urlMatchesPattern("https://github.com/", "")).toBe(false)
  })
})

describe("urlMatchesRule", () => {
  it("accepts a single pattern or an array of patterns", () => {
    expect(urlMatchesRule("https://x.com/home", { matches: "x.com" })).toBe(true)
    expect(urlMatchesRule("https://x.com/home", { matches: ["twitter.com", "x.com"] })).toBe(true)
    expect(urlMatchesRule("https://x.com/home", { matches: ["twitter.com"] })).toBe(false)
  })

  it("carves out excludeMatches", () => {
    const rule = {
      matches: "github.com",
      excludeMatches: ["github.com/settings/*", "github.com/*/*/settings"],
    }
    expect(urlMatchesRule("https://github.com/foo/bar", rule)).toBe(true)
    expect(urlMatchesRule("https://github.com/settings/profile", rule)).toBe(false)
    expect(urlMatchesRule("https://github.com/foo/bar/settings", rule)).toBe(false)
  })
})
