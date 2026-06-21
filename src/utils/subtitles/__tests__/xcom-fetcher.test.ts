// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { XcomSubtitlesFetcher } from "../fetchers/xcom"

describe("x.com subtitles fetcher", () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("falls back to the next parseable HLS subtitle track", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/user/status/2043652922849014046",
      },
      writable: true,
    })
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\"><video src=\"https://video.twimg.com/amplify_video/2042527457786679296/vid/avc1/test.mp4\"></video></div></article>"

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      {
        entryType: "resource",
        name: "https://video.twimg.com/amplify_video/2042527457786679296/pl/stale-master.m3u8?tag=20",
        startTime: 2,
      } as PerformanceResourceTiming,
      {
        entryType: "resource",
        name: "https://video.twimg.com/amplify_video/2042527457786679296/pl/master.m3u8?tag=21",
        startTime: 1,
      } as PerformanceResourceTiming,
    ])

    const responseByUrl = new Map<string, string>([
      [
        "https://video.twimg.com/amplify_video/2042527457786679296/pl/master.m3u8?tag=21",
        [
          "#EXTM3U",
          "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"Broken\",LANGUAGE=\"en\",URI=\"broken.m3u8\"",
          "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"English\",LANGUAGE=\"en\",URI=\"good.m3u8\"",
        ].join("\n"),
      ],
      [
        "https://video.twimg.com/amplify_video/2042527457786679296/pl/good.m3u8",
        "#EXTM3U\n#EXTINF:4.000,\n/subtitles/amplify_video/2042527457786679296/0/good.vtt",
      ],
      [
        "https://video.twimg.com/subtitles/amplify_video/2042527457786679296/0/good.vtt",
        "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello from x.com",
      ],
      [
        "https://video.twimg.com/amplify_video/2042527457786679296/pl/stale-master.m3u8?tag=20",
        [
          "#EXTM3U",
          "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"Stale\",LANGUAGE=\"en\",URI=\"stale.m3u8\"",
        ].join("\n"),
      ],
    ])

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = responseByUrl.get(url)
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        text: async () => body ?? "",
      }
    }))

    const fetcher = new XcomSubtitlesFetcher()

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Hello from x.com",
        start: 1000,
        end: 2000,
      },
    ])
  })

  it("uses the Read Frog marked x.com video when a status page has multiple visible videos", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/juristr/status/2068409619089936730",
      },
      writable: true,
    })
    document.body.innerHTML = [
      "<article><div data-testid=\"videoPlayer\" data-read-frog-xcom-player-container=\"true\"><video id=\"target\"></video></div></article>",
      "<article><div data-testid=\"videoPlayer\"><video id=\"below-fold\"></video></div></article>",
    ].join("")

    const targetVideo = document.querySelector("#target") as HTMLVideoElement
    const belowFoldVideo = document.querySelector("#below-fold") as HTMLVideoElement
    const targetTrack = {
      label: "en (auto-generated)",
      language: "en",
      mode: "showing",
      cues: [
        {
          text: "<X-word-ms ms=1 index=1>Agree with Theo here</X-word-ms>",
          startTime: 0,
          endTime: 2,
        },
      ],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const unrelatedTrack = {
      label: "en (auto-generated)",
      language: "en",
      mode: "showing",
      cues: [
        {
          text: "Wrong visible video",
          startTime: 0,
          endTime: 2,
        },
      ],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    Object.defineProperty(targetVideo, "textTracks", {
      value: [targetTrack],
      configurable: true,
    })
    Object.defineProperty(belowFoldVideo, "textTracks", {
      value: [unrelatedTrack],
      configurable: true,
    })
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([])

    const fetcher = new XcomSubtitlesFetcher()

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Agree with Theo here",
        start: 0,
        end: 2000,
      },
    ])
  })

  it("hides native x.com text tracks without overriding later user selection", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/juristr/status/2068409619089936730",
      },
      writable: true,
    })
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\" data-read-frog-xcom-player-container=\"true\"><video></video></div></article>"

    const video = document.querySelector("video") as HTMLVideoElement
    const showingTrack = {
      label: "English",
      language: "en",
      mode: "showing",
      cues: [
        {
          text: "Selected English captions",
          startTime: 0,
          endTime: 2,
        },
      ],
    }
    const hiddenTrack = {
      label: "Spanish",
      language: "es",
      mode: "hidden",
      cues: [
        {
          text: "User selected Spanish captions",
          startTime: 0,
          endTime: 2,
        },
      ],
    }

    Object.defineProperty(video, "textTracks", {
      value: [hiddenTrack, showingTrack],
      configurable: true,
    })
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([])

    const fetcher = new XcomSubtitlesFetcher()

    fetcher.hideNativeSubtitles()

    expect(showingTrack.mode).toBe("hidden")
    expect(hiddenTrack.mode).toBe("hidden")

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Selected English captions",
        start: 0,
        end: 2000,
      },
    ])

    hiddenTrack.mode = "showing"
    fetcher.hideNativeSubtitles()

    expect(showingTrack.mode).toBe("hidden")
    expect(hiddenTrack.mode).toBe("hidden")

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "User selected Spanish captions",
        start: 0,
        end: 2000,
      },
    ])

    fetcher.showNativeSubtitles()

    expect(showingTrack.mode).toBe("hidden")
    expect(hiddenTrack.mode).toBe("showing")
  })

  it("restores hidden native tracks for their original x.com video", () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/juristr/status/2068409619089936730",
      },
      writable: true,
    })
    document.body.innerHTML = [
      "<article><div id=\"old-player\" data-testid=\"videoPlayer\" data-read-frog-xcom-player-container=\"true\"><video id=\"old-video\"></video></div></article>",
      "<article><div id=\"new-player\" data-testid=\"videoPlayer\"><video id=\"new-video\"></video></div></article>",
    ].join("")

    const oldVideo = document.querySelector("#old-video") as HTMLVideoElement
    const newVideo = document.querySelector("#new-video") as HTMLVideoElement
    const oldTrack = {
      label: "Old English",
      language: "en",
      mode: "showing",
    }
    const newTrack = {
      label: "New Spanish",
      language: "es",
      mode: "showing",
    }
    Object.defineProperty(oldVideo, "textTracks", {
      value: [oldTrack],
      configurable: true,
    })
    Object.defineProperty(newVideo, "textTracks", {
      value: [newTrack],
      configurable: true,
    })

    const fetcher = new XcomSubtitlesFetcher()
    fetcher.hideNativeSubtitles()

    expect(oldTrack.mode).toBe("hidden")

    document.querySelector("#old-player")?.removeAttribute("data-read-frog-xcom-player-container")
    document.querySelector("#new-player")?.setAttribute("data-read-frog-xcom-player-container", "true")

    fetcher.showNativeSubtitles()

    expect(oldTrack.mode).toBe("showing")
    expect(newTrack.mode).toBe("showing")
  })

  it("waits for text track cues that load without cuechange events", async () => {
    vi.useFakeTimers()
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/theo/status/2068176117186617471",
      },
      writable: true,
    })
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\"><video src=\"https://video.twimg.com/amplify_video/2068409550827581440/vid/avc1/test.mp4\"></video></div></article>"

    const video = document.querySelector("video") as HTMLVideoElement
    let cues: Array<{ text: string, startTime: number, endTime: number }> | null = null
    const track = {
      label: "en (auto-generated)",
      language: "en",
      mode: "disabled",
      get cues() {
        return cues
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    Object.defineProperty(video, "textTracks", {
      value: [track],
      configurable: true,
    })
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([])

    setTimeout(() => {
      cues = [
        {
          text: "<X-word-ms ms=80 index=1>I think it's fair to say that the way</X-word-ms>",
          startTime: 0,
          endTime: 1.12,
        },
      ]
    }, 3000)

    const fetcher = new XcomSubtitlesFetcher()
    const fetchPromise = fetcher.fetch()

    await vi.advanceTimersByTimeAsync(3100)

    await expect(fetchPromise).resolves.toEqual([
      {
        text: "I think it's fair to say that the way",
        start: 0,
        end: 1120,
      },
    ])
  })

  it("uses direct X subtitle playlists from resource timing when the master manifest is unavailable", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/juristr/status/2068409619089936730",
      },
      writable: true,
    })
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\"><video src=\"https://video.twimg.com/amplify_video/2068409550827581440/vid/avc1/test.mp4\"></video></div></article>"

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      {
        entryType: "resource",
        name: "https://video.twimg.com/amplify_video/2068409550827581440/pl/s0/rEVE20Oqy8c9upYK.m3u8",
        startTime: 10,
      } as PerformanceResourceTiming,
    ])

    const responseByUrl = new Map<string, string>([
      [
        "https://video.twimg.com/amplify_video/2068409550827581440/pl/s0/rEVE20Oqy8c9upYK.m3u8",
        [
          "#EXTM3U",
          "#EXT-X-PLAYLIST-TYPE:VOD",
          "#EXTINF:25.491,",
          "/subtitles/amplify_video/2068409550827581440/0/lA-jgVQ0ox3x-pj6.vtt",
          "#EXT-X-ENDLIST",
        ].join("\n"),
      ],
      [
        "https://video.twimg.com/subtitles/amplify_video/2068409550827581440/0/lA-jgVQ0ox3x-pj6.vtt",
        "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nAgree with Theo here",
      ],
    ])

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = responseByUrl.get(url)
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        text: async () => body ?? "",
      }
    }))

    const fetcher = new XcomSubtitlesFetcher()

    await expect(fetcher.fetch()).resolves.toEqual([
      {
        text: "Agree with Theo here",
        start: 0,
        end: 2000,
      },
    ])
  })

  it("reports delayed X subtitle playlists as available before fetching them", async () => {
    vi.useFakeTimers()
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/OpenAI/status/1834278223775187374",
      },
      writable: true,
    })
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\"><video src=\"https://video.twimg.com/ext_tw_video/1834274285684391936/pu/vid/avc1/test.mp4\"></video></div></article>"

    let subtitlesPlaylistRequested = false
    vi.spyOn(performance, "getEntriesByType").mockImplementation(() => {
      if (!subtitlesPlaylistRequested) {
        return []
      }

      return [
        {
          entryType: "resource",
          name: "https://video.twimg.com/ext_tw_video/1834274285684391936/pu/pl/s0/3Uz2gP6z7E0RXH2d.m3u8",
          startTime: 10,
        } as PerformanceResourceTiming,
      ]
    })

    const responseByUrl = new Map<string, string>([
      [
        "https://video.twimg.com/ext_tw_video/1834274285684391936/pu/pl/s0/3Uz2gP6z7E0RXH2d.m3u8",
        [
          "#EXTM3U",
          "#EXT-X-PLAYLIST-TYPE:VOD",
          "#EXTINF:120.245,",
          "/subtitles/ext_tw_video/1834274285684391936/0/lszhXGwhsdW9N5q4.vtt",
          "#EXT-X-ENDLIST",
        ].join("\n"),
      ],
      [
        "https://video.twimg.com/subtitles/ext_tw_video/1834274285684391936/0/lszhXGwhsdW9N5q4.vtt",
        "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nWe need make a game",
      ],
    ])

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = responseByUrl.get(url)
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        text: async () => body ?? "",
      }
    }))

    setTimeout(() => {
      subtitlesPlaylistRequested = true
    }, 1000)

    const fetcher = new XcomSubtitlesFetcher()
    const availabilityPromise = fetcher.hasAvailableSubtitles()

    await vi.advanceTimersByTimeAsync(1100)

    await expect(availabilityPromise).resolves.toBe(true)

    const fetchPromise = fetcher.fetch()

    await vi.advanceTimersByTimeAsync(0)

    await expect(fetchPromise).resolves.toEqual([
      {
        text: "We need make a game",
        start: 0,
        end: 2000,
      },
    ])
  })

  it("does not accept stale valid resource-timing subtitles from another video", async () => {
    vi.useFakeTimers()
    Object.defineProperty(window, "location", {
      value: {
        href: "https://x.com/current/status/2068409619089936730",
      },
      writable: true,
    })
    document.body.innerHTML = "<article><div data-testid=\"videoPlayer\"><video src=\"https://video.twimg.com/amplify_video/2068409550827581440/vid/avc1/current.mp4\"></video></div></article>"

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      {
        entryType: "resource",
        name: "https://video.twimg.com/amplify_video/2042527457786679296/pl/stale-master.m3u8?tag=20",
        startTime: 10,
      } as PerformanceResourceTiming,
    ])

    const responseByUrl = new Map<string, string>([
      [
        "https://video.twimg.com/amplify_video/2042527457786679296/pl/stale-master.m3u8?tag=20",
        [
          "#EXTM3U",
          "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"Stale\",LANGUAGE=\"en\",URI=\"stale.m3u8\"",
        ].join("\n"),
      ],
      [
        "https://video.twimg.com/amplify_video/2042527457786679296/pl/stale.m3u8",
        "#EXTM3U\n#EXTINF:4.000,\n/subtitles/amplify_video/2042527457786679296/0/stale.vtt",
      ],
      [
        "https://video.twimg.com/subtitles/amplify_video/2042527457786679296/0/stale.vtt",
        "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nWrong stale caption",
      ],
    ])

    const fetch = vi.fn(async (url: string) => {
      const body = responseByUrl.get(url)
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        text: async () => body ?? "",
      }
    })
    vi.stubGlobal("fetch", fetch)

    const fetcher = new XcomSubtitlesFetcher()
    const fetchPromise = fetcher.fetch()
    const rejectionAssertion = expect(fetchPromise).rejects.toThrow("subtitles.errors.noSubtitlesFound")

    await vi.advanceTimersByTimeAsync(5100)

    await rejectionAssertion
    expect(fetch).not.toHaveBeenCalled()
  })
})
