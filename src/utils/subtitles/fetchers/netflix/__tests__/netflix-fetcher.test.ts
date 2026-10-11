// @vitest-environment jsdom

import type { NetflixSubtitlesResponse } from ".."
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS,
  POST_MESSAGE_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { NetflixSubtitlesFetcher } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

const postMessageRequest =
  vi.fn<
    (
      type: string,
      message: { action: string },
      timeoutMs?: number,
    ) => Promise<NetflixSubtitlesResponse | null>
  >()
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({
  postMessageRequest: (type: string, message: { action: string }, timeoutMs?: number) =>
    postMessageRequest(type, message, timeoutMs),
}))

const TTML = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000" xml:lang="en">
<body><div><p begin="10000000t" end="20000000t">Hello there.</p></div></body>
</tt>`

function response(overrides: Partial<NetflixSubtitlesResponse> = {}): NetflixSubtitlesResponse {
  return {
    type: "response",
    requestId: "1",
    movieId: 1,
    trackId: "T:en",
    translatable: true,
    ttml: TTML,
    ...overrides,
  }
}

function respondWith(byAction: Record<string, NetflixSubtitlesResponse | null>) {
  postMessageRequest.mockImplementation(async (_type, message) => byAction[message.action] ?? null)
}

describe("NetflixSubtitlesFetcher", () => {
  beforeEach(() => {
    postMessageRequest.mockReset()
  })

  it("parses the captured TTML of the loaded track", async () => {
    respondWith({ load: response() })
    const fetcher = new NetflixSubtitlesFetcher()

    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Hello there.", start: 1000, end: 2000 },
    ])
    expect(fetcher.getSourceLanguage()).toBe("en")
    expect(fetcher.isPreSegmented()).toBe(true)
  })

  it("fails when no translatable track could be loaded", async () => {
    respondWith({ load: response({ trackId: null, translatable: false, ttml: null }) })

    await expect(new NetflixSubtitlesFetcher().fetch()).rejects.toThrow(
      "subtitles.errors.noSubtitlesFound",
    )
  })

  it("says the subtitles failed to load when the track's file never reached the page", async () => {
    respondWith({ load: response({ ttml: null }) })

    await expect(new NetflixSubtitlesFetcher().fetch()).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )
  })

  it("reports a player that never became ready as a timeout", async () => {
    respondWith({
      load: response({ movieId: null, trackId: null, translatable: false, ttml: null }),
    })

    await expect(new NetflixSubtitlesFetcher().fetch()).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
  })

  it("waits out the page's load deadline but gives other requests the usual time", async () => {
    respondWith({ load: response(), state: response() })
    const fetcher = new NetflixSubtitlesFetcher()

    await fetcher.fetch()
    await fetcher.shouldUseSameTrack()

    expect(postMessageRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "load" }),
      NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS,
    )
    expect(postMessageRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "state" }),
      POST_MESSAGE_TIMEOUT_MS,
    )
  })

  it("treats a malformed response from the page like no response at all", async () => {
    respondWith({ load: { ...response(), movieId: "1" } as unknown as NetflixSubtitlesResponse })

    await expect(new NetflixSubtitlesFetcher().fetch()).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
  })

  it("keeps its track while the viewer has Netflix subtitles switched off", async () => {
    respondWith({
      load: response(),
      state: response({ trackId: "T:off", translatable: false }),
    })
    const fetcher = new NetflixSubtitlesFetcher()
    await fetcher.fetch()

    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)
  })

  it("reloads when the viewer picks another language or the episode changes", async () => {
    const fetcher = new NetflixSubtitlesFetcher()
    respondWith({ load: response() })
    await fetcher.fetch()

    respondWith({ state: response({ trackId: "T:ja" }) })
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)

    respondWith({ state: response({ movieId: 2 }) })
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })

  it("has no track to compare before its first load", async () => {
    respondWith({ state: response() })

    await expect(new NetflixSubtitlesFetcher().shouldUseSameTrack()).resolves.toBe(false)
    expect(postMessageRequest).not.toHaveBeenCalled()
  })

  it("does not restart a load that is still running", async () => {
    let finishLoad!: (reply: NetflixSubtitlesResponse) => void
    postMessageRequest.mockImplementation((_type, message) =>
      message.action === "load"
        ? new Promise((resolve) => {
            finishLoad = resolve
          })
        : Promise.resolve(response({ trackId: "T:ja" })),
    )
    const fetcher = new NetflixSubtitlesFetcher()
    const loading = fetcher.fetch()

    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)
    expect(postMessageRequest).toHaveBeenCalledTimes(1)

    finishLoad(response())
    await loading
  })

  it("waits for another track or episode before retrying a load that failed", async () => {
    const fetcher = new NetflixSubtitlesFetcher()
    respondWith({ load: response({ ttml: null }), state: response() })
    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)

    respondWith({ state: response({ trackId: "T:ja" }) })
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)

    respondWith({ state: response({ movieId: 2 }) })
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })

  it("retries a load that found no player once the player is ready", async () => {
    const fetcher = new NetflixSubtitlesFetcher()
    const noPlayer = response({ movieId: null, trackId: null, translatable: false, ttml: null })
    respondWith({ load: noPlayer, state: noPlayer })
    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.fetchSubTimeout")

    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)

    respondWith({ state: response() })
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })

  it("never serves the previous track's subtitles after a load of another track fails", async () => {
    const fetcher = new NetflixSubtitlesFetcher()
    respondWith({ load: response() })
    await fetcher.fetch()
    respondWith({ load: response({ trackId: "T:ja", ttml: null }) })
    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    respondWith({
      load: response({ trackId: "T:ja", ttml: TTML.replace("Hello there.", "やあ。") }),
    })

    await expect(fetcher.fetch()).resolves.toEqual([{ text: "やあ。", start: 1000, end: 2000 }])
  })

  it("asks the page to put back the track it replaced when native subtitles return", () => {
    respondWith({})
    new NetflixSubtitlesFetcher().showNativeSubtitles()

    expect(postMessageRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "restore" }),
      POST_MESSAGE_TIMEOUT_MS,
    )
  })
})
