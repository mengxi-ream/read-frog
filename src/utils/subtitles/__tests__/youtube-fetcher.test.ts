// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { PLAYER_DATA_REQUEST_TYPE, PLAYER_DATA_RESPONSE_TYPE } from "@/utils/constants/subtitles"
import { YoutubeSubtitlesFetcher } from "../fetchers/youtube"

describe("youtube subtitles fetcher", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("ignores unrelated postMessage events while waiting", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: { search: "?v=test123", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })

    const promise = fetcher.fetch()

    let settled: "resolved" | "rejected" | null = null
    void promise.then(
      () => { settled = "resolved" },
      () => { settled = "rejected" },
    )

    window.dispatchEvent(new MessageEvent("message", {
      data: { foo: "bar" },
      origin: window.location.origin,
    }))

    await Promise.resolve()
    expect(settled).toBeNull()

    fetcher.cleanup()
  })

  it("handles player data response correctly", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: { search: "?v=test123", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })

    const originalPostMessage = window.postMessage.bind(window)
    ;(window as any).postMessage = function (message: any, targetOrigin: string) {
      originalPostMessage(message, targetOrigin)
      if (message?.type === PLAYER_DATA_REQUEST_TYPE) {
        setTimeout(() => {
          window.dispatchEvent(new MessageEvent("message", {
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
                cachedTimedtextUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
              },
            },
          }))
        }, 0)
      }
    }

    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.noSubtitlesFound")

    fetcher.cleanup()
  })

  it("uses the initial player data snapshot for a fast fetch before fallback waits", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: { search: "?v=test123", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [{
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
        languageCode: "en",
        vssId: ".en",
      }],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 0,
      selectedTrackLanguageCode: "en",
      cachedTimedtextUrl: null,
    }

    const requestPlayerDataSpy = vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry").mockResolvedValue([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])
    const waitForPlayerStateSpy = vi.spyOn(fetcher as any, "waitForPlayerState").mockResolvedValue(undefined)
    const getPlayerDataWithPotSpy = vi.spyOn(fetcher as any, "getPlayerDataWithPot").mockResolvedValue(playerData)

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
      value: { search: "?v=test123", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [{
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
        languageCode: "en",
        vssId: ".en",
      }],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 1,
      selectedTrackLanguageCode: "en",
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
      value: { search: "?v=test123", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })

    const playerData = {
      videoId: "test123",
      captionTracks: [{
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
        languageCode: "en",
        vssId: ".en",
      }],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 0,
      selectedTrackLanguageCode: "en",
      cachedTimedtextUrl: null,
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: playerData,
    })
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])
    const waitForPlayerStateSpy = vi.spyOn(fetcher as any, "waitForPlayerState").mockResolvedValue(undefined)
    const getPlayerDataWithPotSpy = vi.spyOn(fetcher as any, "getPlayerDataWithPot").mockResolvedValue(playerData)

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(2)
    expect(processRawEventsSpy).toHaveBeenCalledTimes(1)
    expect(waitForPlayerStateSpy).toHaveBeenCalledTimes(1)
    expect(getPlayerDataWithPotSpy).toHaveBeenCalledTimes(1)
  })

  it("re-selects the track from refreshed fallback player data", async () => {
    const fetcher = new YoutubeSubtitlesFetcher()

    Object.defineProperty(window, "location", {
      value: { search: "?v=test123", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })

    const initialPlayerData = {
      videoId: "test123",
      captionTracks: [{
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=en",
        languageCode: "en",
        vssId: ".en",
      }],
      audioCaptionTracks: [],
      device: null,
      cver: null,
      playerState: 0,
      selectedTrackLanguageCode: "en",
      cachedTimedtextUrl: null,
    }
    const refreshedPlayerData = {
      ...initialPlayerData,
      captionTracks: [{
        baseUrl: "https://www.youtube.com/api/timedtext?v=test123&lang=fr",
        languageCode: "fr",
        vssId: ".fr",
      }],
      selectedTrackLanguageCode: "fr",
    }

    vi.spyOn(fetcher as any, "requestPlayerData").mockResolvedValue({
      success: true,
      data: initialPlayerData,
    })
    const fetchWithRetrySpy = vi.spyOn(fetcher as any, "fetchWithRetry")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([])
    const processRawEventsSpy = vi.spyOn(fetcher as any, "processRawEvents").mockResolvedValue([])
    const waitForPlayerStateSpy = vi.spyOn(fetcher as any, "waitForPlayerState").mockResolvedValue(undefined)
    const getPlayerDataWithPotSpy = vi.spyOn(fetcher as any, "getPlayerDataWithPot").mockResolvedValue(refreshedPlayerData)

    await expect(fetcher.fetch()).resolves.toEqual([])

    expect(fetchWithRetrySpy).toHaveBeenCalledTimes(2)
    expect(fetchWithRetrySpy.mock.calls[1]?.[0]).toContain("lang=fr")
    expect(processRawEventsSpy).toHaveBeenCalledTimes(1)
    expect(waitForPlayerStateSpy).toHaveBeenCalledTimes(1)
    expect(getPlayerDataWithPotSpy).toHaveBeenCalledTimes(1)
  })
})
