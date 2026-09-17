import { describe, expect, it } from "vitest"
import { getXcomStatusIdFromUrl } from "../video-id/xcom"

describe("getXcomStatusIdFromUrl", () => {
  it("extracts the status id from a canonical x.com status url", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/someone/status/1234567890")).toBe("1234567890")
  })

  it("extracts the status id from the /i/status/ form", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/i/status/1234567890")).toBe("1234567890")
  })

  it("extracts the status id from a video sub-route", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/someone/status/1234567890/video/1")).toBe(
      "1234567890",
    )
    expect(getXcomStatusIdFromUrl("https://x.com/i/status/1234567890/video/1")).toBe("1234567890")
  })

  it("tolerates a trailing slash and a query string", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/someone/status/1234567890/")).toBe("1234567890")
    expect(getXcomStatusIdFromUrl("https://x.com/someone/status/1234567890?s=20")).toBe(
      "1234567890",
    )
  })

  it("still supports twitter.com and its subdomains", () => {
    expect(getXcomStatusIdFromUrl("https://twitter.com/someone/status/1234567890")).toBe(
      "1234567890",
    )
    expect(getXcomStatusIdFromUrl("https://mobile.twitter.com/someone/status/1234567890")).toBe(
      "1234567890",
    )
    expect(getXcomStatusIdFromUrl("https://mobile.x.com/someone/status/1234567890")).toBe(
      "1234567890",
    )
  })

  it("returns null for non-status x.com routes", () => {
    expect(getXcomStatusIdFromUrl("https://x.com/home")).toBeNull()
    expect(getXcomStatusIdFromUrl("https://x.com/someone")).toBeNull()
    expect(getXcomStatusIdFromUrl("https://x.com/someone/status/notanumber")).toBeNull()
  })

  it("returns null for look-alike hosts", () => {
    expect(getXcomStatusIdFromUrl("https://notx.com/someone/status/1234567890")).toBeNull()
    expect(getXcomStatusIdFromUrl("https://x.com.evil.test/someone/status/1234567890")).toBeNull()
  })

  it("returns null for a malformed url", () => {
    expect(getXcomStatusIdFromUrl("not a url")).toBeNull()
  })
})
