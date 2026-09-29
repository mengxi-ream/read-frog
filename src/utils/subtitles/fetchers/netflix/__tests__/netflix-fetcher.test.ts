// @vitest-environment jsdom

import type { NetflixSubtitlesResponse } from ".."
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NetflixSubtitlesFetcher } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

const postMessageRequest =
  vi.fn<(type: string, message: { action: string }) => Promise<NetflixSubtitlesResponse | null>>()
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({
  postMessageRequest: (type: string, message: { action: string }) =>
    postMessageRequest(type, message),
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

  it("asks the page to put back the track it replaced when native subtitles return", () => {
    respondWith({})
    new NetflixSubtitlesFetcher().showNativeSubtitles()

    expect(postMessageRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: "restore" }),
    )
  })
})
