// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as configStorage from "@/utils/config/storage"
import {
  MAX_FETCH_RETRIES,
  MAX_PLAYER_RESPONSE_WAIT_ATTEMPTS,
  MAX_PLAYER_WAIT_ATTEMPTS,
  PLAYER_DATA_REQUEST_TYPE,
  PLAYER_DATA_RESPONSE_TYPE,
  PLAYER_RESPONSE_PENDING_ERROR,
} from "@/utils/constants/subtitles"
import { OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { YoutubeSubtitlesFetcher } from "../fetchers/youtube"

function setWatchLocation(videoId: string) {
  Object.defineProperty(window, "location", {
    value: {
      href: `https://www.youtube.com/watch?v=${videoId}`,
      search: `?v=${videoId}`,
      origin: "https://www.youtube.com",
      pathname: "/watch",
      hostname: "www.youtube.com",
    },
    writable: true,
  })
}

describe("youtube caption download", () => {
  const url = "https://www.youtube.com/api/timedtext?v=test123&lang=ja&kind=asr&fmt=json3"

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // YouTube answers a caption request without a valid POT with 200 and an empty body.
  it("reports an empty caption body as an invalid response, not the parser's message", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const fetcher = new YoutubeSubtitlesFetcher()

    const result = (fetcher as any).fetchWithRetry(url).catch((error: unknown) => error)
    await vi.runAllTimersAsync()
    const error = await result

    expect(error).toBeInstanceOf(OverlaySubtitlesError)
    expect(error).toMatchObject({ message: "subtitles.errors.invalidResponse" })
    expect(fetchMock).toHaveBeenCalledTimes(MAX_FETCH_RETRIES)
  })

  it("still retries an empty body and returns the events once a real one arrives", async () => {
    const events = [{ tStartMs: 0, dDurationMs: 500, segs: [{ utf8: "こんにちは" }] }]
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => new Response("", { status: 200 }))
      .mockImplementation(async () => Response.json({ events }))
    vi.stubGlobal("fetch", fetchMock)
    const fetcher = new YoutubeSubtitlesFetcher()

    const result = (fetcher as any).fetchWithRetry(url)
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual(events)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("youtube subtitles availability lookup", () => {
  const playerData = {
    videoId: "test123",
    captionTracks: [
      {
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=ja&kind=asr",
        languageCode: "ja",
        kind: "asr",
        vssId: "a.ja",
      },
    ],
    audioCaptionTracks: [],
    device: null,
    cver: null,
    playerState: 1,
    selectedTrackLanguageCode: "ja",
    selectedTrackVssId: "a.ja",
    defaultCaptionTrackIndex: null,
    cachedTimedtextUrl: null,
    isLiveContent: false,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    setWatchLocation("test123")
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("retries until the player catches up to the current video", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockResolvedValueOnce({ success: false, error: "VIDEO_ID_MISMATCH" })
      .mockResolvedValueOnce({ success: false, error: "PLAYER_NOT_FOUND" })
      .mockResolvedValue({ success: true, data: playerData })

    const result = fetcher.hasAvailableSubtitles()
    await vi.runAllTimersAsync()

    await expect(result).resolves.toBe(true)
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(3)
  })

  it("reports a player that never reaches this video as a failed lookup, not as no subtitles", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockResolvedValue({ success: false, error: "VIDEO_ID_MISMATCH" })

    const result = fetcher.hasAvailableSubtitles().catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    expect(await result).toMatchObject({ message: "subtitles.errors.fetchSubTimeout" })
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(MAX_PLAYER_WAIT_ATTEMPTS)
  })

  // AdGuard can hold the player response for seconds on a cold load while the player is
  // already on this video.
  it("keeps waiting past the usual cap while the player's response is on the way", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const pendingAnswers = MAX_PLAYER_WAIT_ATTEMPTS + 30
    let calls = 0
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockImplementation(async () =>
        ++calls <= pendingAnswers
          ? { success: false, error: PLAYER_RESPONSE_PENDING_ERROR }
          : { success: true, data: playerData },
      )

    const result = fetcher.hasAvailableSubtitles()
    await vi.runAllTimersAsync()

    await expect(result).resolves.toBe(true)
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(pendingAnswers + 1)
  })

  it("gives up on a player response that never arrives after the longer wait", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockResolvedValue({ success: false, error: PLAYER_RESPONSE_PENDING_ERROR })

    const result = fetcher.hasAvailableSubtitles().catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    expect(await result).toMatchObject({ message: "subtitles.errors.fetchSubTimeout" })
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(MAX_PLAYER_RESPONSE_WAIT_ATTEMPTS)
  })

  it("stops waiting once the fetcher is cleaned up", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    let calls = 0
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockImplementation(async () => {
        if (++calls === 3) fetcher.cleanup()
        return { success: false, error: PLAYER_RESPONSE_PENDING_ERROR }
      })

    const result = fetcher.hasAvailableSubtitles().catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    expect(await result).toMatchObject({ message: "subtitles.errors.fetchSubTimeout" })
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(3)
  })

  it("does not repeat a request the page never answered", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockResolvedValue({ success: false, error: "TIMEOUT" })

    await expect(fetcher.hasAvailableSubtitles()).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(1)
  })

  it("stops waiting once the page has moved on to another video", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const requestPlayerDataSpy = vi
      .spyOn(fetcher as any, "requestPlayerData")
      .mockImplementation(async () => {
        setWatchLocation("next456")
        return { success: false, error: "VIDEO_ID_MISMATCH" }
      })

    await expect(fetcher.hasAvailableSubtitles()).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(1)
  })

  it("answers no subtitles only when the player has this video and no caption tracks", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: { ...playerData, captionTracks: [] },
    })

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(false)
  })

  // During a pre-roll ad the player's audio track, and every token on it, belongs to the ad.
  it("keeps waiting for this video's token while only the ad's are on the player", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    const duringAd = {
      ...playerData,
      audioCaptionTracks: [
        {
          url: "https://www.youtube.com/api/timedtext?v=adVideo0001&lang=en&pot=AD_POT&potc=1",
          vssId: ".en",
          languageCode: "en",
        },
      ],
    }
    const afterAd = {
      ...playerData,
      audioCaptionTracks: [
        {
          url: "https://www.youtube.com/api/timedtext?v=test123&lang=ja&kind=asr&pot=OWN_POT&potc=1",
          vssId: "a.ja",
          kind: "asr",
          languageCode: "ja",
        },
      ],
    }
    vi.spyOn(fetcher as any, "requestPlayerData")
      .mockResolvedValueOnce({ success: true, data: duringAd })
      .mockResolvedValueOnce({ success: true, data: duringAd })
      .mockResolvedValue({ success: true, data: afterAd })
    vi.spyOn(fetcher as any, "ensureSubtitlesEnabled").mockResolvedValue(undefined)
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])

    const result = (fetcher as any).getPlayerDataWithPot("test123")
    await vi.runAllTimersAsync()
    const resolved = await result
    await (fetcher as any).fetchTrackEvents(playerData.captionTracks[0], resolved)

    expect(resolved).toBe(afterAd)
    expect(fetchWithRetrySpy.mock.calls[0]?.[0]).toContain("pot=OWN_POT")
  })
})

describe("youtube subtitles fetcher", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("ignores unrelated postMessage events while waiting", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const promise = fetcher.fetch()

    let settled: "resolved" | "rejected" | null = null
    void promise.then(
      () => {
        settled = "resolved"
      },
      () => {
        settled = "rejected"
      },
    )

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { foo: "bar" },
        origin: window.location.origin,
      }),
    )

    await Promise.resolve()
    expect(settled).toBeNull()

    fetcher.cleanup()
  })

  it("handles player data response correctly", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const originalPostMessage = window.postMessage.bind(window)
    ;(window as any).postMessage = function (message: any, targetOrigin: string) {
      originalPostMessage(message, targetOrigin)
      if (message?.type === PLAYER_DATA_REQUEST_TYPE) {
        setTimeout(() => {
          window.dispatchEvent(
            new MessageEvent("message", {
              origin: window.location.origin,
              data: {
                type: PLAYER_DATA_RESPONSE_TYPE,
                requestId: message.requestId,
                success: true,
                data: {
                  videoId: "test123",
                  captionTracks: [],
                  audioCaptionTracks: [],
                  device: null,
                  cver: null,
                  playerState: 1,
                  selectedTrackLanguageCode: null,
                  selectedTrackVssId: null,
                  defaultCaptionTrackIndex: null,
                  cachedTimedtextUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
                  isLiveContent: false,
                },
              },
            }),
          )
        }, 0)
      }
    }

    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.noSubtitlesFound")

    fetcher.cleanup()
  })

  it("uses the initial player data snapshot for a fast fetch before fallback waits", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 0,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: ".en",
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }

    const requestPlayerDataSpy = vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])
    const waitForPlayerStateSpy = vi
      .spyOn(fetcher as any, "waitForPlayerState")
      .mockResolvedValue(undefined)
    const getPlayerDataWithPotSpy = vi
      .spyOn(fetcher as any, "getPlayerDataWithPot")
      .mockResolvedValue(playerData)

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(2)
    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1)
    expect(processRawEventsSpy).toHaveBeenCalledTimes(1)
    expect(waitForPlayerStateSpy).not.toHaveBeenCalled()
    expect(getPlayerDataWithPotSpy).not.toHaveBeenCalled()
  })

  it("returns cached subtitles before attempting a fast timedtext fetch", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: ".en",
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }
    const cachedSubtitles = [{ text: "cached", start: 0, end: 1 }]

    ;(fetcher as any).subtitles = cachedSubtitles
    ;(fetcher as any).cachedTrackHash = "test123:en::.en"

    const requestPlayerDataSpy = vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const tryFastFetchSpy = vi.spyOn(fetcher as any, "tryFastFetch")

    await expect(fetcher.fetch()).resolves.toEqual(cachedSubtitles)

    expect(requestPlayerDataSpy).toHaveBeenCalledTimes(1)
    expect(tryFastFetchSpy).not.toHaveBeenCalled()
  })

  it("falls back to the slower POT flow when the fast fetch fails", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 0,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: ".en",
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const fetchWithRetrySpy = vi
      .spyOn(fetcher as any, "fetchWithRetry")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])
    const waitForPlayerStateSpy = vi
      .spyOn(fetcher as any, "waitForPlayerState")
      .mockResolvedValue(undefined)
    const getPlayerDataWithPotSpy = vi
      .spyOn(fetcher as any, "getPlayerDataWithPot")
      .mockResolvedValue(playerData)

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(2)
    expect(processRawEventsSpy).toHaveBeenCalledTimes(1)
    expect(waitForPlayerStateSpy).toHaveBeenCalledTimes(1)
    expect(getPlayerDataWithPotSpy).toHaveBeenCalledTimes(1)
  })

  it("re-selects the track from refreshed fallback player data", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const initialPlayerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 0,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: ".en",
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }
    const refreshedPlayerData = {
      ...initialPlayerData,
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=fr",
          languageCode: "fr",
          vssId: ".fr",
        },
      ],
      selectedTrackLanguageCode: "fr",
      selectedTrackVssId: ".fr",
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: initialPlayerData,
    })
    const fetchWithRetrySpy = vi
      .spyOn(fetcher as any, "fetchWithRetry")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])
    const waitForPlayerStateSpy = vi
      .spyOn(fetcher as any, "waitForPlayerState")
      .mockResolvedValue(undefined)
    const getPlayerDataWithPotSpy = vi
      .spyOn(fetcher as any, "getPlayerDataWithPot")
      .mockResolvedValue(refreshedPlayerData)

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(2)
    expect(fetchWithRetrySpy.mock.calls[1]?.[0]).toContain("lang=fr")
    expect(processRawEventsSpy).toHaveBeenCalledTimes(1)
    expect(waitForPlayerStateSpy).toHaveBeenCalledTimes(1)
    expect(getPlayerDataWithPotSpy).toHaveBeenCalledTimes(1)
  })

  it("prefers the selected vssId when multiple tracks share the same language", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en&fmt=vtt",
          languageCode: "en",
          vssId: ".en",
        },
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en&kind=asr",
          languageCode: "en",
          kind: "asr",
          vssId: "a.en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: "a.en",
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(1)
    expect(fetchWithRetrySpy.mock.calls[0]?.[0]).toContain("kind=asr")
    expect(processRawEventsSpy).toHaveBeenCalledTimes(1)
  })

  it("follows YouTube's own default caption track without touching the CC button", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=ar",
          languageCode: "ar",
          vssId: ".ar",
        },
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      selectedTrackLanguageCode: null,
      selectedTrackVssId: null,
      defaultCaptionTrackIndex: 1,
      cachedTimedtextUrl: null,
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const ensureSubtitlesEnabledSpy = vi.spyOn(fetcher as any, "ensureSubtitlesEnabled")
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy.mock.calls[0]?.[0]).toContain("lang=en")
    expect(fetcher.getSourceLanguage()).toBe("en")
    expect(ensureSubtitlesEnabledSpy).not.toHaveBeenCalled()
  })

  it("prefers the viewer's live selection over YouTube's default caption track", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=ar",
          languageCode: "ar",
          vssId: ".ar",
        },
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      selectedTrackLanguageCode: "ar",
      selectedTrackVssId: ".ar",
      defaultCaptionTrackIndex: 1,
      cachedTimedtextUrl: null,
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy.mock.calls[0]?.[0]).toContain("lang=ar")
  })

  it("falls back to turning on YouTube CC when the response carries no default track", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const captionTracks = [
      {
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=ar",
        languageCode: "ar",
        vssId: ".ar",
      },
      {
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
        languageCode: "en",
        vssId: ".en",
      },
    ]
    const basePlayerData = {
      videoId: "test123",
      captionTracks,
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }
    const captionsOff = {
      ...basePlayerData,
      selectedTrackLanguageCode: null,
      selectedTrackVssId: null,
    }
    const captionsOn = {
      ...basePlayerData,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: ".en",
    }

    let captionsEnabled = false
    const ensureSubtitlesEnabledSpy = vi
      .spyOn(fetcher as any, "ensureSubtitlesEnabled")
      .mockImplementation(async () => {
        captionsEnabled = true
      })
    vi.spyOn(fetcher as any, "requestPlayerData").mockImplementation(async () => ({
      success: true,
      data: captionsEnabled ? captionsOn : captionsOff,
    }))
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(ensureSubtitlesEnabledSpy).toHaveBeenCalledTimes(1)
    expect(fetchWithRetrySpy.mock.calls[0]?.[0]).toContain("lang=en")
    expect(fetcher.getSourceLanguage()).toBe("en")
  })

  it("does not toggle YouTube CC when the player already reports a selected track", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: {
        href: "https://www.youtube.com/watch?v=test123",
        search: "?v=test123",
        origin: "https://www.youtube.com",
        pathname: "/watch",
        hostname: "www.youtube.com",
      },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
          languageCode: "en",
          vssId: ".en",
        },
      ],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      selectedTrackLanguageCode: "en",
      selectedTrackVssId: ".en",
      defaultCaptionTrackIndex: null,
      cachedTimedtextUrl: null,
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const ensureSubtitlesEnabledSpy = vi.spyOn(fetcher as any, "ensureSubtitlesEnabled")
    vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(ensureSubtitlesEnabledSpy).not.toHaveBeenCalled()
  })

  it("returns raw parser fragments for non-AI standard subtitles", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    ;(fetcher as any).sourceLanguage = "en"
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      videoSubtitles: {
        aiSegmentation: false,
      },
    } as any)

    const result = await (fetcher as any).processRawEvents([
      { tStartMs: 0, dDurationMs: 500, segs: [{ utf8: "I agree." }] },
      { tStartMs: 500, dDurationMs: 500, segs: [{ utf8: "It is true." }] },
      { tStartMs: 1000, dDurationMs: 500, segs: [{ utf8: "We can do this." }] },
      { tStartMs: 1500, dDurationMs: 500, segs: [{ utf8: "Let's ship now." }] },
    ])

    expect(result).toEqual([
      { text: "I agree.", start: 0, end: 500 },
      { text: "It is true.", start: 500, end: 1000 },
      { text: "We can do this.", start: 1000, end: 1500 },
      { text: "Let's ship now.", start: 1500, end: 2000 },
    ])
  })

  it("keeps raw standard fragments when AI segmentation is enabled", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()
    ;(fetcher as any).sourceLanguage = "en"
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue({
      videoSubtitles: {
        aiSegmentation: true,
      },
    } as any)

    const result = await (fetcher as any).processRawEvents([
      { tStartMs: 0, dDurationMs: 500, segs: [{ utf8: "I agree." }] },
      { tStartMs: 500, dDurationMs: 500, segs: [{ utf8: "It is true." }] },
    ])

    expect(result).toEqual([
      { text: "I agree.", start: 0, end: 500 },
      { text: "It is true.", start: 500, end: 1000 },
    ])
  })
})
