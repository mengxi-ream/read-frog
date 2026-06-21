import { describe, expect, it } from "vitest"
import { getXcomStatusIdFromUrl } from "../video-id"

describe("x.com status id", () => {
  it("extracts status ids from x.com status detail URLs", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/GirlRulesGMMTV/status/2043652922849014046")).toBe("2043652922849014046")
    expect(getXcomStatusIdFromUrl("https://x.com/i/status/2043652922849014046")).toBe("2043652922849014046")
    expect(getXcomStatusIdFromUrl("https://www.x.com/user/status/2043652922849014046/video/1")).toBe("2043652922849014046")
  })

  it("extracts status ids from twitter.com status detail URLs", () => {
    expect(getXcomStatusIdFromUrl("https://twitter.com/user/status/2059086745506046329")).toBe("2059086745506046329")
    expect(getXcomStatusIdFromUrl("https://mobile.twitter.com/user/status/2059086745506046329?s=20")).toBe("2059086745506046329")
  })

  it("rejects non-status and non-X URLs", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/home")).toBeNull()
    expect(getXcomStatusIdFromUrl("https://example.com/user/status/2043652922849014046")).toBeNull()
    expect(getXcomStatusIdFromUrl("not a url")).toBeNull()
  })

  it("rejects unsupported status subroutes outside status detail and first video", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/user/status/2043652922849014046/photo/1")).toBeNull()
    expect(getXcomStatusIdFromUrl("https://x.com/user/status/2043652922849014046/video/2")).toBeNull()
    expect(getXcomStatusIdFromUrl("https://x.com/user/status/2043652922849014046/analytics")).toBeNull()
  })
})
