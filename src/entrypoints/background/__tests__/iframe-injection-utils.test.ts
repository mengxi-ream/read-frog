import { describe, expect, it } from "vitest"
import { isSameOriginIframeSender, resolveSiteControlUrl } from "../iframe-injection-utils"

describe("isSameOriginIframeSender", () => {
  it.each([
    ["https://example.com/app", undefined, "https://example.com/frame", true],
    ["https://example.com/app", undefined, "http://example.com/frame", false],
    ["https://example.com/app", undefined, "https://example.com:444/frame", false],
    ["https://example.com/app", undefined, "https://sub.example.com/frame", false],
    ["https://example.com/app", "null", "https://example.com/frame", false],
    ["https://example.com/app", "https://example.com", "about:srcdoc", true],
    ["file:///article", undefined, "file:///frame", false],
  ])("compares effective origins for %s / %s / %s", (top, origin, frame, expected) => {
    expect(isSameOriginIframeSender(top, origin, frame)).toBe(expected)
  })
})

describe("resolveSiteControlUrl", () => {
  it("keeps regular page URLs unchanged", () => {
    expect(resolveSiteControlUrl(2, "https://example.com/app", [])).toBe("https://example.com/app")
  })

  it("falls back to the parent page URL for about:blank frames", () => {
    const frames = [
      { frameId: 0, parentFrameId: -1, url: "https://example.com/app" },
      { frameId: 7, parentFrameId: 0, url: "about:blank" },
    ]

    expect(resolveSiteControlUrl(7, "about:blank", frames)).toBe("https://example.com/app")
  })

  it("walks up the frame tree until it finds a real site URL", () => {
    const frames = [
      { frameId: 0, parentFrameId: -1, url: "https://example.com/app" },
      { frameId: 2, parentFrameId: 0, url: "about:blank" },
      { frameId: 5, parentFrameId: 2, url: "about:srcdoc" },
    ]

    expect(resolveSiteControlUrl(5, "about:srcdoc", frames)).toBe("https://example.com/app")
  })

  it("uses the parent frame hint when the current frame is missing from the snapshot", () => {
    const frames = [{ frameId: 0, parentFrameId: -1, url: "https://example.com/app" }]

    expect(resolveSiteControlUrl(42, "about:blank", frames, 0)).toBe("https://example.com/app")
  })

  it("resolves to the nearest real ancestor when a missing leaf frame belongs to a blocked nested iframe", () => {
    const frames = [
      { frameId: 0, parentFrameId: -1, url: "https://allowed.com/page" },
      { frameId: 3, parentFrameId: 0, url: "https://blocked.com/embed" },
    ]

    expect(resolveSiteControlUrl(9, "about:blank", frames, 3)).toBe("https://blocked.com/embed")
  })

  it("fails closed when a blank frame cannot be resolved to a real ancestor URL", () => {
    const frames = [{ frameId: 0, parentFrameId: -1, url: "about:blank" }]

    expect(resolveSiteControlUrl(42, "about:blank", frames)).toBeUndefined()
  })
})
