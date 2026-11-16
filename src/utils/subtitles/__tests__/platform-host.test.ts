import { describe, expect, it } from "vitest"
import { getSubtitlesPlatformForHostname, isSubtitlesOffOnHost } from "../platform-host"

describe("getSubtitlesPlatformForHostname", () => {
  it("names the platform of every host the subtitles loader goes into", () => {
    expect(getSubtitlesPlatformForHostname("www.youtube.com")).toBe("youtube")
    expect(getSubtitlesPlatformForHostname("m.youtube.com")).toBe("youtube")
    // An embedded player is YouTube's, whatever page it sits in.
    expect(getSubtitlesPlatformForHostname("www.youtube-nocookie.com")).toBe("youtube")
    expect(getSubtitlesPlatformForHostname("x.com")).toBe("xcom")
    expect(getSubtitlesPlatformForHostname("mobile.twitter.com")).toBe("xcom")
    expect(getSubtitlesPlatformForHostname("www.netflix.com")).toBe("netflix")
    expect(getSubtitlesPlatformForHostname("www.bilibili.com")).toBe("bilibili")
    expect(getSubtitlesPlatformForHostname("www.udemy.com")).toBe("udemy")
    expect(getSubtitlesPlatformForHostname("acme.udemy.com")).toBe("udemy")
    expect(getSubtitlesPlatformForHostname("courses.edx.org")).toBe("edx")
  })

  it("names no platform for other hosts, lookalikes included", () => {
    expect(getSubtitlesPlatformForHostname("blog.example")).toBeNull()
    expect(getSubtitlesPlatformForHostname("notyoutube.com")).toBeNull()
    expect(getSubtitlesPlatformForHostname("learning.edx.org")).toBeNull()
  })
})

describe("isSubtitlesOffOnHost", () => {
  const platforms = {
    youtube: "auto",
    xcom: "manual",
    netflix: "off",
    bilibili: "manual",
    udemy: "manual",
    edx: "manual",
  } as const

  it("goes by the mode of the host's platform", () => {
    expect(isSubtitlesOffOnHost({ platforms }, "www.netflix.com")).toBe(true)
    expect(isSubtitlesOffOnHost({ platforms }, "www.youtube.com")).toBe(false)
    expect(isSubtitlesOffOnHost({ platforms }, "x.com")).toBe(false)
  })

  it("reads the single switch of a config stored before per-site modes", () => {
    expect(isSubtitlesOffOnHost({ enabled: false }, "www.youtube.com")).toBe(true)
    expect(isSubtitlesOffOnHost({ enabled: true }, "www.youtube.com")).toBe(false)
  })

  it("is never off for a host no platform plays on, or without a config", () => {
    expect(isSubtitlesOffOnHost({ platforms }, "blog.example")).toBe(false)
    expect(isSubtitlesOffOnHost(undefined, "www.netflix.com")).toBe(false)
  })
})
