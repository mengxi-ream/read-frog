// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
} from "@/utils/constants/subtitles"
import { collectStreamingSubtitleTracks, injectStreamingSubtitlesInterceptor } from "../streaming-subtitles-interceptor"

describe("streaming subtitles interceptor", () => {
  it("collects official Netflix timed text downloadables", () => {
    const tracks = collectStreamingSubtitleTracks({
      result: {
        timedtexttracks: [
          {
            bcp47: "en-US",
            languageDescription: "English (CC)",
            trackType: "ASSISTIVE",
            ttDownloadables: {
              webvtt: {
                downloadUrls: {
                  "en-US": "https://example.test/nflxvideo/en-track",
                },
              },
            },
          },
          {
            bcp47: "zh-Hant",
            languageDescription: "中文（繁體）",
            trackType: "PRIMARY",
            ttDownloadables: {
              dfxp: {
                downloadUrls: {
                  "zh-Hant": "https://example.test/nflxvideo/zh-track",
                },
              },
            },
          },
        ],
      },
    })

    expect(tracks).toEqual([
      {
        url: "https://example.test/nflxvideo/en-track",
        language: "en-US",
        label: "English (CC)",
        kind: "ASSISTIVE",
      },
      {
        url: "https://example.test/nflxvideo/zh-track",
        language: "zh-Hant",
        label: "中文（繁體）",
        kind: "PRIMARY",
      },
    ])
  })

  it("ignores unrelated localized media URLs", () => {
    const tracks = collectStreamingSubtitleTracks({
      images: [
        {
          language: "en-US",
          imageUrl: "https://example.test/poster.jpg",
        },
      ],
    })

    expect(tracks).toEqual([])
  })

  it("replays cached manifest tracks when the subtitle runtime starts later", () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.netflix.com/watch/1",
        hostname: "www.netflix.com",
        origin: "https://www.netflix.com",
      },
      configurable: true,
    })
    delete window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__

    const postMessageSpy = vi.spyOn(window, "postMessage")
    injectStreamingSubtitlesInterceptor()

    JSON.parse(JSON.stringify({
      result: {
        timedtexttracks: [
          {
            bcp47: "en-US",
            languageDescription: "English (CC)",
            trackType: "ASSISTIVE",
            ttDownloadables: {
              dfxp: {
                downloadUrls: {
                  "en-US": "https://example.test/nflxvideo/en-track",
                },
              },
            },
          },
        ],
      },
    }))

    postMessageSpy.mockClear()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: { type: STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE },
    }))

    expect(postMessageSpy).toHaveBeenCalledWith({
      type: STREAMING_SUBTITLE_TRACKS_TYPE,
      tracks: [
        {
          url: "https://example.test/nflxvideo/en-track",
          language: "en-US",
          label: "English (CC)",
          kind: "ASSISTIVE",
        },
      ],
    }, window.location.origin)
  })
})
