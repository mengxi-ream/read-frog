// @vitest-environment jsdom
import type { StreamingSiteAdapter, StreamingTrack } from "../fetchers/streaming/streaming-fetcher"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as configStorage from "@/utils/config/storage"
import { parseSubtitleText } from "../fetchers/streaming/cue-parser"
import { StreamingSubtitlesFetcher } from "../fetchers/streaming/streaming-fetcher"

const EN_VTT = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello
`

const ZH_VTT = `WEBVTT

00:00:00.000 --> 00:00:01.000
你好
`

function setLocation(pathname: string) {
  Object.defineProperty(window, "location", {
    value: { href: `https://stream.example${pathname}`, hostname: "stream.example", origin: "https://stream.example", pathname },
    writable: true,
  })
}

// Fake site adapter exercising the shared source/target selection + alignment that
// every streaming adapter (Netflix, and HBO Max in the follow-up) reuses.
function fakeSite(tracks: StreamingTrack[]): StreamingSiteAdapter {
  return {
    id: "fake",
    matches: () => true,
    discoverTracks: async () => tracks,
    fetchTrack: async (track: StreamingTrack) => parseSubtitleText(track.id === "zh" ? ZH_VTT : EN_VTT),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("streamingSubtitlesFetcher", () => {
  it("aligns official source + target tracks into bilingual fragments", async () => {
    setLocation("/watch/1")
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({ language: { targetCode: "cmn-Hant" } } as any)
    const fetcher = new StreamingSubtitlesFetcher(fakeSite([
      { id: "en", language: "en", label: "English" },
      { id: "zh", language: "zh-Hant", label: "中文（繁體）" },
    ]))

    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Hello", translation: "你好", start: 0, end: 1000 },
    ])
    expect(fetcher.isPreSegmented()).toBe(true)
  })
})
