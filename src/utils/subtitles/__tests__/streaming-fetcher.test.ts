// @vitest-environment jsdom
import type { SubtitlesFragment } from "../types"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as configStorage from "@/utils/config/storage"
import { STREAMING_SUBTITLE_TRACKS_TYPE } from "@/utils/constants/subtitles"
import { selectStreamingSubtitleTrack, StreamingSubtitlesFetcher } from "../fetchers/streaming"
import { clearStreamingSubtitleCaptures } from "../fetchers/streaming/captured-subtitles"
import { parseStreamingSubtitles } from "../fetchers/streaming/parser"

const mocks = vi.hoisted(() => ({
  backgroundFetch: vi.fn(),
}))

vi.mock("@/utils/content-script/background-fetch-client", () => ({
  backgroundFetch: mocks.backgroundFetch,
}))

describe("streaming subtitles", () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ""
    clearStreamingSubtitleCaptures()
    mocks.backgroundFetch.mockReset()
    vi.restoreAllMocks()
  })

  it("parses WebVTT cues", () => {
    expect(parseStreamingSubtitles(`
WEBVTT

00:00:01.000 --> 00:00:02.500
Hello <c>world</c>

00:00:03,000 --> 00:00:04,000 align:start
Second line
    `)).toEqual([
      { text: "Hello world", start: 1000, end: 2500 },
      { text: "Second line", start: 3000, end: 4000 },
    ])
  })

  it("parses TTML cues", () => {
    expect(parseStreamingSubtitles(`
<tt>
  <body>
    <div>
      <p begin="00:00:01.000" end="00:00:02.000">Hello<br />world</p>
      <p t="2500" d="500">Again</p>
    </div>
  </body>
</tt>
    `)).toEqual([
      { text: "Hello\nworld", start: 1000, end: 2000 },
      { text: "Again", start: 2500, end: 3000 },
    ])
  })

  it("parses Netflix TTML tick cues", () => {
    expect(parseStreamingSubtitles(`
<tt xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000">
  <body>
    <div>
      <p begin="56312506t" end="81332500t">- WHEN YOU FIND</p>
    </div>
  </body>
</tt>
    `)).toEqual([
      { text: "- WHEN YOU FIND", start: 5631.2506, end: 8133.25 },
    ])
  })

  it("prefers configured source language over the target-language track", () => {
    const track = selectStreamingSubtitleTrack([
      { url: "https://example.test/zh.vtt", language: "zh-Hans", kind: "PRIMARY" },
      { url: "https://example.test/en.vtt", language: "en", kind: "PRIMARY" },
    ], {
      sourceCode: "eng",
      targetCode: "cmn",
    })

    expect(track?.url).toBe("https://example.test/en.vtt")
  })

  it("falls back to native caption DOM cues", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)

    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 12
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    const line = document.createElement("span")
    line.textContent = "Hello"
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    expect(await fetcher.hasAvailableSubtitles()).toBe(true)
    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Hello", start: 11700, end: 18000 },
    ])

    const replayedSubtitles: string[] = []
    const replayUnsubscribe = fetcher.watchLiveSubtitles((subtitles) => {
      replayedSubtitles.push(...subtitles.map(subtitle => subtitle.text))
    })
    expect(replayedSubtitles).toContain("Hello")
    replayUnsubscribe()

    const liveSubtitles: string[] = []
    const unsubscribe = fetcher.watchLiveSubtitles((subtitles) => {
      liveSubtitles.push(...subtitles.map(subtitle => subtitle.text))
    })

    video.currentTime = 15
    line.textContent = "Next"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    expect(liveSubtitles).toContain("Next")
    unsubscribe()
    fetcher.cleanup()
  })

  it("prefers available native captions over streaming track metadata", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 20
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    caption.textContent = "Native cue"
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [{ url: "https://example.test/en.vtt", language: "en" }],
      },
    }))

    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Native cue", start: 19700, end: 26000 },
    ])
    expect(mocks.backgroundFetch).not.toHaveBeenCalled()
    fetcher.cleanup()
  })

  it("waits for delayed Netflix native captions before using streaming track metadata", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockResolvedValue({
      ok: true,
      text: async () => "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nStreaming cue",
    })

    const video = document.createElement("video")
    video.currentTime = 25
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    const line = document.createElement("span")
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [{ url: "https://example.test/en.vtt", language: "en" }],
      },
    }))

    const subtitlesPromise = fetcher.fetch()
    await Promise.resolve()

    line.textContent = "Delayed native"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    await expect(subtitlesPromise).resolves.toEqual([
      { text: "Delayed native", start: 24700, end: 31000 },
    ])
    expect(mocks.backgroundFetch).not.toHaveBeenCalled()
    fetcher.cleanup()
  })

  it("uses official target-language streaming subtitles instead of machine translation", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => url.includes("zh")
        ? "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n官方中文第一句官方中文第二句\n官方中文第一句\n官方中文第二句"
        : "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nOfficial English oneOfficial English two\nOfficial English one\nOfficial English two",
    }))

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://example.test/en.vtt", label: "English" },
          { url: "https://example.test/zh.vtt", label: "繁體中文" },
        ],
      },
    }))

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Official English one\nOfficial English two",
        translation: "官方中文第一句\n官方中文第二句",
        start: 1000,
        end: 3000,
      },
    ])
    expect(fetcher.isPreSegmented?.()).toBe(true)
    fetcher.cleanup()
  })

  it("aligns official English cues to the target-language subtitle timing", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn-Hant",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => url.includes("zh")
        ? "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n我會殺了你和你朋友 再把現場弄成是你們自相殘殺"
        : "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nI THINK I KILL YOU\n\n00:00:02.000 --> 00:00:03.000\nMAKE IT LOOK LIKE",
    }))

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://example.test/en.vtt", language: "en", label: "英語", kind: "ASSISTIVE" },
          { url: "https://example.test/zh.vtt", language: "zh-Hant", label: "中文（繁體）", kind: "PRIMARY" },
        ],
      },
    }))

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "I THINK I KILL YOU\nMAKE IT LOOK LIKE",
        translation: "我會殺了你和你朋友 再把現場弄成是你們自相殘殺",
        start: 1_000,
        end: 3_000,
      },
    ])
    fetcher.cleanup()
  })

  it("assigns an official English cue to the target cue with the largest overlap", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn-Hant",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => url.includes("zh")
        ? "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n第一句\n\n00:00:02.500 --> 00:00:04.000\n第二句"
        : "WEBVTT\n\n00:00:01.000 --> 00:00:02.200\nFIRST ENGLISH\n\n00:00:02.200 --> 00:00:03.900\nSECOND ENGLISH",
    }))

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://example.test/en.vtt", language: "en", label: "英語", kind: "ASSISTIVE" },
          { url: "https://example.test/zh.vtt", language: "zh-Hant", label: "中文（繁體）", kind: "PRIMARY" },
        ],
      },
    }))

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "FIRST ENGLISH",
        translation: "第一句",
        start: 1_000,
        end: 2_500,
      },
      {
        text: "SECOND ENGLISH",
        translation: "第二句",
        start: 2_500,
        end: 4_000,
      },
    ])
    fetcher.cleanup()
  })

  it("prefers labeled official Netflix subtitle tracks over media URLs and watch routes", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn-Hant",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => url.includes("official-zh")
        ? "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n官方繁中"
        : "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nOfficial English",
    }))

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://video.example.test/media-en", language: "en", kind: "PRIMARY" },
          { url: "https://video.example.test/media-zh", language: "zh-Hant", kind: "PRIMARY" },
          { url: "https://www.netflix.com/watch/subtitles", language: "zh-Hant", label: "中文（繁體）", kind: "PRIMARY" },
          { url: "https://video.example.test/official-zh", language: "zh-Hant", label: "中文（繁體）", kind: "PRIMARY" },
          { url: "https://video.example.test/official-en", language: "en", label: "英語", kind: "ASSISTIVE" },
        ],
      },
    }))

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Official English",
        translation: "官方繁中",
        start: 1_000,
        end: 3_000,
      },
    ])
    expect(mocks.backgroundFetch).toHaveBeenCalledWith(
      "https://video.example.test/official-en",
      undefined,
      { credentials: "include" },
    )
    expect(mocks.backgroundFetch).toHaveBeenCalledWith(
      "https://video.example.test/official-zh",
      undefined,
      { credentials: "include" },
    )
    fetcher.cleanup()
  })

  it("prefers Netflix assistive English captions over original audio tracks", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn-Hant",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => {
        if (url.includes("audio-original"))
          return "audio bytes"
        if (url.includes("official-zh"))
          return "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n官方繁中"
        return "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nOfficial English"
      },
    }))

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://video.example.test/audio-original", language: "en", label: "英語 [原始]", kind: "PRIMARY" },
          { url: "https://video.example.test/official-en", language: "en", label: "英語", kind: "ASSISTIVE" },
          { url: "https://video.example.test/official-zh", language: "zh-Hant", label: "中文（繁體）", kind: "PRIMARY" },
        ],
      },
    }))

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Official English",
        translation: "官方繁中",
        start: 1_000,
        end: 3_000,
      },
    ])
    expect(mocks.backgroundFetch).not.toHaveBeenCalledWith(
      "https://video.example.test/audio-original",
      undefined,
      { credentials: "include" },
    )
    expect(mocks.backgroundFetch).toHaveBeenCalledWith(
      "https://video.example.test/official-en",
      undefined,
      { credentials: "include" },
    )
    fetcher.cleanup()
  })

  it("waits for delayed official bilingual tracks before falling back to Netflix native captions", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => url.includes("zh")
        ? "WEBVTT\n\n00:00:10.000 --> 00:00:12.000\n官方中文"
        : "WEBVTT\n\n00:00:10.000 --> 00:00:12.000\nOfficial English",
    }))

    const video = document.createElement("video")
    video.currentTime = 15
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    caption.textContent = "Native cue"
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    const subtitlesPromise = fetcher.fetch()
    await Promise.resolve()

    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://example.test/en.vtt", label: "English" },
          { url: "https://example.test/zh.vtt", label: "繁體中文" },
        ],
      },
    }))

    await expect(subtitlesPromise).resolves.toEqual([
      {
        text: "Official English",
        translation: "官方中文",
        start: 10_000,
        end: 12_000,
      },
    ])
    expect(mocks.backgroundFetch).toHaveBeenCalledTimes(2)
    expect(fetcher.isPreSegmented?.()).toBe(true)
    fetcher.cleanup()
  })

  it("falls back to Netflix native captions when official bilingual tracks cannot be fetched", async () => {
    vi.useFakeTimers()
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      language: {
        sourceCode: "auto",
        targetCode: "cmn",
      },
    } as any)
    mockNetflixLocation()
    mocks.backgroundFetch.mockRejectedValue(new Error("blocked"))

    const video = document.createElement("video")
    video.currentTime = 22
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    caption.textContent = "Native fallback"
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      data: {
        type: STREAMING_SUBTITLE_TRACKS_TYPE,
        tracks: [
          { url: "https://example.test/en.vtt", label: "English" },
          { url: "https://example.test/zh.vtt", label: "繁體中文" },
        ],
      },
    }))

    const subtitlesPromise = fetcher.fetch()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(3_000)

    await expect(subtitlesPromise).resolves.toEqual([
      { text: "Native fallback", start: 21_700, end: 28_000 },
    ])
    expect(mocks.backgroundFetch).toHaveBeenCalledTimes(2)
    fetcher.cleanup()
  })

  it("reads the first non-empty native caption element", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 30
    document.body.appendChild(video)

    const emptyCaption = document.createElement("div")
    emptyCaption.className = "player-timedtext"
    document.body.appendChild(emptyCaption)

    const caption = document.createElement("div")
    caption.className = "player-timedtext-text-container"
    const line = document.createElement("span")
    line.textContent = "Second container"
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Second container", start: 29700, end: 36000 },
    ])
    fetcher.cleanup()
  })

  it("shortens the previous native cue when Netflix advances to the next caption", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 60
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    const line = document.createElement("span")
    line.textContent = "First"
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "First", start: 59_700, end: 66_000 },
    ])

    const emissions: SubtitlesFragment[][] = []
    const unsubscribe = fetcher.watchLiveSubtitles((subtitles) => {
      emissions.push(subtitles.map(subtitle => ({ ...subtitle })))
    })

    video.currentTime = 61
    line.textContent = "Second"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    expect(emissions.at(-1)).toEqual([
      { text: "First", start: 59_700, end: 60_700 },
      { text: "Second", start: 60_700, end: 67_000 },
    ])
    unsubscribe()
    fetcher.cleanup()
  })

  it("shortens the previous native cue when Netflix clears captions", async () => {
    vi.useFakeTimers()
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 60
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    const line = document.createElement("span")
    line.textContent = "First"
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "First", start: 59_700, end: 66_000 },
    ])

    const emissions: SubtitlesFragment[][] = []
    const unsubscribe = fetcher.watchLiveSubtitles((subtitles) => {
      emissions.push(subtitles.map(subtitle => ({ ...subtitle })))
    })

    video.currentTime = 61
    line.textContent = ""
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    video.currentTime = 61.6
    await vi.advanceTimersByTimeAsync(500)

    expect(emissions.at(-1)).toEqual([
      { text: "First", start: 59_700, end: 61_600 },
    ])
    unsubscribe()
    fetcher.cleanup()
  })

  it("collapses duplicated native caption spans", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 35
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    for (const text of ["Line one", "Line two", "Line one", "Line two"]) {
      const line = document.createElement("span")
      line.textContent = text
      caption.appendChild(line)
    }
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Line one\nLine two", start: 34700, end: 41000 },
    ])
    fetcher.cleanup()
  })

  it("does not recapture the same native caption after a short blank frame", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 40
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    const line = document.createElement("span")
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    const liveSubtitles: string[] = []
    const unsubscribe = fetcher.watchLiveSubtitles((subtitles) => {
      liveSubtitles.push(...subtitles.map(subtitle => subtitle.text))
    })

    line.textContent = "Again"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    video.currentTime = 41
    line.textContent = ""
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    line.textContent = "Again"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    expect(liveSubtitles.filter(text => text === "Again")).toHaveLength(1)
    unsubscribe()
    fetcher.cleanup()
  })

  it("does not recapture the same native caption with different whitespace", async () => {
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null as any)
    mockNetflixLocation()

    const video = document.createElement("video")
    video.currentTime = 50
    document.body.appendChild(video)

    const caption = document.createElement("div")
    caption.className = "player-timedtext"
    const line = document.createElement("span")
    caption.appendChild(line)
    document.body.appendChild(caption)

    const fetcher = new StreamingSubtitlesFetcher()
    const liveSubtitles: string[] = []
    const unsubscribe = fetcher.watchLiveSubtitles((subtitles) => {
      liveSubtitles.push(...subtitles.map(subtitle => subtitle.text))
    })

    line.textContent = "Hello world"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    video.currentTime = 51
    line.textContent = "Hello\nworld"
    caption.appendChild(document.createTextNode(""))
    await Promise.resolve()

    expect(liveSubtitles.filter(text => text.replace(/\s+/g, "") === "Helloworld")).toHaveLength(1)
    unsubscribe()
    fetcher.cleanup()
  })
})

function mockNetflixLocation() {
  Object.defineProperty(window, "location", {
    value: {
      origin: "https://www.netflix.com",
      href: "https://www.netflix.com/watch/1",
      hostname: "www.netflix.com",
    },
    writable: true,
  })
}
