// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as configStorage from "@/utils/config/storage"
import { STREAMING_SUBTITLE_TRACKS_TYPE } from "@/utils/constants/subtitles"
import * as backgroundFetchClient from "@/utils/content-script/background-fetch-client"
import { NetflixSubtitlesFetcher } from "../fetchers/netflix"

const EN_VTT = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello
`

const ZH_HANS_VTT = `WEBVTT

00:00:00.000 --> 00:00:01.000
简体
`

const ZH_HANT_VTT = `WEBVTT

00:00:00.000 --> 00:00:01.000
繁體
`

function setNetflixPath(pathname: string) {
  Object.defineProperty(window, "location", {
    value: {
      href: `https://www.netflix.com${pathname}`,
      origin: "https://www.netflix.com",
      hostname: "www.netflix.com",
      pathname,
    },
    writable: true,
  })
}

function publishTracks(tracks: Array<{ url: string, language?: string, label?: string, kind?: string, pagePath?: string }>) {
  window.dispatchEvent(new MessageEvent("message", {
    origin: window.location.origin,
    data: {
      type: STREAMING_SUBTITLE_TRACKS_TYPE,
      tracks,
    },
  }))
}

function mockConfig(targetCode: string) {
  vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
    language: { targetCode },
  } as any)
}

function mockSubtitleFetch(textByUrl: Record<string, string>) {
  return vi.spyOn(backgroundFetchClient, "backgroundFetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    return {
      ok: true,
      text: async () => textByUrl[url] ?? "",
    } as Response
  })
}

describe("netflix subtitles fetcher", () => {
  let fetcher: NetflixSubtitlesFetcher

  beforeEach(() => {
    setNetflixPath("/watch/new")
    fetcher = new NetflixSubtitlesFetcher()
  })

  afterEach(() => {
    fetcher.cleanup()
    vi.restoreAllMocks()
  })

  it("prefers the exact Chinese variant over the broad Chinese fallback", async () => {
    mockConfig("cmn-Hant")
    mockSubtitleFetch({
      "https://cdn.example/en.vtt": EN_VTT,
      "https://cdn.example/zh-hans.vtt": ZH_HANS_VTT,
      "https://cdn.example/zh-hant.vtt": ZH_HANT_VTT,
    })

    publishTracks([
      { url: "https://cdn.example/en.vtt", language: "en", label: "English" },
      { url: "https://cdn.example/zh-hans.vtt", language: "zh-Hans", label: "中文（简体）" },
      { url: "https://cdn.example/zh-hant.vtt", language: "zh-Hant", label: "中文（繁體）" },
    ])

    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Hello", translation: "繁體", start: 0, end: 1000 },
    ])
  })

  it("ignores subtitle tracks discovered for a previous Netflix title", async () => {
    mockConfig("cmn-Hant")
    const backgroundFetchSpy = mockSubtitleFetch({
      "https://cdn.example/current-en.vtt": EN_VTT,
      "https://cdn.example/current-zh.vtt": ZH_HANT_VTT,
      "https://cdn.example/old-en.vtt": "old english",
      "https://cdn.example/old-zh.vtt": "old chinese",
    })

    publishTracks([
      { url: "https://cdn.example/old-en.vtt", language: "en", pagePath: "/watch/old" },
      { url: "https://cdn.example/old-zh.vtt", language: "zh-Hant", pagePath: "/watch/old" },
    ])

    const subtitlesPromise = fetcher.fetch()

    publishTracks([
      { url: "https://cdn.example/current-en.vtt", language: "en", pagePath: "/watch/new" },
      { url: "https://cdn.example/current-zh.vtt", language: "zh-Hant", pagePath: "/watch/new" },
    ])

    await expect(subtitlesPromise).resolves.toEqual([
      { text: "Hello", translation: "繁體", start: 0, end: 1000 },
    ])
    expect(backgroundFetchSpy).not.toHaveBeenCalledWith("https://cdn.example/old-en.vtt", expect.anything(), expect.anything())
    expect(backgroundFetchSpy).not.toHaveBeenCalledWith("https://cdn.example/old-zh.vtt", expect.anything(), expect.anything())
  })
})
