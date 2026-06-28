// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { collectStreamingSubtitleTracks, injectStreamingSubtitlesInterceptor } from "@/entrypoints/interceptor.content/streaming-subtitles-interceptor"
import { STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE, STREAMING_SUBTITLE_TRACKS_TYPE } from "@/utils/constants/subtitles"

function setNetflixLocation() {
  Object.defineProperty(window, "location", {
    value: { href: "https://www.netflix.com/watch/1", hostname: "www.netflix.com", origin: "https://www.netflix.com", pathname: "/watch/1" },
    writable: true,
  })
}

describe("netflix subtitle interceptor", () => {
  const originalFetch = window.fetch
  const originalJSONParse = JSON.parse

  afterEach(() => {
    window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ = false
    window.fetch = originalFetch
    JSON.parse = originalJSONParse
    vi.restoreAllMocks()
  })

  it("collects timed-text download URLs while ignoring media download URLs", () => {
    setNetflixLocation()
    const tracks = collectStreamingSubtitleTracks({
      timedtexttracks: [
        {
          language: "en",
          languageDescription: "Off",
          trackType: "PRIMARY",
          downloadUrls: { video: "https://media.example/video-chunk" },
        },
        {
          language: "zh-Hant",
          languageDescription: "中文（繁體）",
          trackType: "PRIMARY",
          ttDownloadables: {
            "webvtt-lssdh-ios8": {
              downloadUrls: { default: "https://subtitle.example/no-extension-token" },
            },
          },
        },
      ],
    })

    expect(tracks).toEqual([
      {
        url: "https://subtitle.example/no-extension-token",
        language: "zh-Hant",
        label: "中文（繁體）",
        kind: "PRIMARY",
      },
    ])
  })

  it("replays known Netflix JSON resources when tracks were missed before injection", async () => {
    setNetflixLocation()
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: "https://www.netflix.com/manifest?movieid=1" },
    ] as PerformanceEntry[])
    const fakeResponse = {
      headers: { get: () => "application/json" },
      clone() {
        return this
      },
      text: async () => JSON.stringify({
        timedtexttracks: [{
          language: "en",
          languageDescription: "English",
          trackType: "PRIMARY",
          ttDownloadables: { webvtt: { downloadUrls: { default: "https://subtitle.example/en.vtt" } } },
        }],
      }),
    } as unknown as Response
    const fetchSpy = vi.fn().mockResolvedValue(fakeResponse)
    window.fetch = fetchSpy
    const postMessageSpy = vi.spyOn(window, "postMessage")

    injectStreamingSubtitlesInterceptor()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: { type: STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE },
    }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchSpy).toHaveBeenCalledWith("https://www.netflix.com/manifest?movieid=1", { credentials: "include" })
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [{
          url: "https://subtitle.example/en.vtt",
          language: "en",
          label: "English",
          kind: "PRIMARY",
          pagePath: "/watch/1",
        }],
      },
      "https://www.netflix.com",
    )
  })
})
