// @vitest-environment jsdom

import type { PrimeVideoSubtitlesResponse } from ".."
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NoSubtitlesError, TrackFileNotLoadedError } from "@/utils/subtitles/errors"
import { primeVideoTrackSource } from ".."
import { TrackSubtitlesFetcher } from "../../track"

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/sleep", () => ({ sleep: () => Promise.resolve() }))

const postMessageRequest = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({
  postMessageRequest: (...args: unknown[]) => postMessageRequest(...args),
}))

const subtitle = (languageCode: string, type = "Subtitle") => ({
  languageCode,
  type,
  subtype: "Dialog",
  format: "TTMLv2",
  url: `https://cf-timedtext.aux.pv-cdn.net/${languageCode}-${type}.ttml2`,
})

// As Prime lists an episode: untimed ad slots, a logo card first, and here a 4 s card mid-way.
const PLAYLIST = [
  { type: "Remote" },
  { type: "Card", startMs: 0, endMs: 6000 },
  { type: "Main", startMs: 0, endMs: 2_657_333, defaultAudioTrackId: "en-us_dialog_0" },
  { type: "Remote" },
  { type: "Card", startMs: 0, endMs: 4000 },
  { type: "Main", startMs: 2_657_333, endMs: 4_413_000, defaultAudioTrackId: "en-us_dialog_0" },
]

const TTML = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="en-US"><body><div>
<p begin="00:00:07.208" end="00:00:08.583">Ancient and powerful.</p>
<p begin="00:44:17.333" end="00:44:18.000">On the boundary.</p>
<p begin="00:45:00.000" end="00:45:02.000">After the break.</p>
</div></body></tt>`

function response(
  resources: Partial<NonNullable<PrimeVideoSubtitlesResponse["resources"]>> | null = {},
): PrimeVideoSubtitlesResponse {
  return {
    type: "response",
    requestId: "1",
    resources: resources && {
      timedText: { subtitleUrls: [subtitle("de-de"), subtitle("en-us", "Sdh"), subtitle("fr-fr")] },
      playlist: PLAYLIST,
      ...resources,
    },
  }
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  postMessageRequest.mockResolvedValue(response())
  fetchMock.mockImplementation(async () => new Response(TTML))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("primeVideoTrackSource", () => {
  it("keys the track by the title the page script marked on the open player's video", () => {
    expect(primeVideoTrackSource.currentKey()).toBeNull()

    document.body.innerHTML = `<div id="dv-web-player"><video data-read-frog-title-id="amzn1.dv.gti.1"></video></div>`
    const rects = vi.spyOn(HTMLVideoElement.prototype, "getClientRects")
    rects.mockReturnValue([new DOMRect(0, 0, 1707, 847)] as unknown as DOMRectList)
    expect(primeVideoTrackSource.currentKey()).toBe("amzn1.dv.gti.1")

    // A closed player is only hidden, its video still marked.
    rects.mockReturnValue([] as unknown as DOMRectList)
    expect(primeVideoTrackSource.currentKey()).toBeNull()
    rects.mockRestore()
  })

  it("loads the subtitles in the audio's language and places them on the video's timeline", async () => {
    const track = await primeVideoTrackSource.load("amzn1.dv.gti.1")

    expect(postMessageRequest.mock.calls[0]?.[1]).toMatchObject({ titleId: "amzn1.dv.gti.1" })
    expect(fetchMock).toHaveBeenCalledWith(subtitle("en-us", "Sdh").url)
    expect(track).toEqual({
      language: "en-US",
      // The first part follows the 6 s logo card, the second also the 4 s card before it.
      fragments: [
        { text: "Ancient and powerful.", start: 13_208, end: 14_583 },
        { text: "On the boundary.", start: 2_667_333, end: 2_668_000 },
        { text: "After the break.", start: 2_710_000, end: 2_712_000 },
      ],
    })
  })

  it("takes the plain subtitles over the ones that describe sounds", async () => {
    postMessageRequest.mockResolvedValue(
      response({
        timedText: { subtitleUrls: [subtitle("en-us", "Sdh"), subtitle("en-us")] },
      }),
    )

    await primeVideoTrackSource.load("amzn1.dv.gti.1")

    expect(fetchMock).toHaveBeenCalledWith(subtitle("en-us").url)
  })

  it("takes the subtitles in the language spoken over English", async () => {
    const spokenInGerman = PLAYLIST.map((item) =>
      item.type === "Main" ? { ...item, defaultAudioTrackId: "de-de_dialog_0" } : item,
    )
    postMessageRequest.mockResolvedValue(
      response({
        playlist: spokenInGerman,
        timedText: { subtitleUrls: [subtitle("en-us"), subtitle("de-de")] },
      }),
    )

    await primeVideoTrackSource.load("amzn1.dv.gti.1")

    expect(fetchMock).toHaveBeenCalledWith(subtitle("de-de").url)
  })

  it("falls back to English, then to the first listed, and never to forced narratives", async () => {
    const spokenInJapanese = PLAYLIST.map((item) =>
      item.type === "Main" ? { ...item, defaultAudioTrackId: "ja-jp_dialog_0" } : item,
    )
    postMessageRequest.mockResolvedValue(response({ playlist: spokenInJapanese }))
    await primeVideoTrackSource.load("amzn1.dv.gti.1")
    expect(fetchMock).toHaveBeenLastCalledWith(subtitle("en-us", "Sdh").url)

    postMessageRequest.mockResolvedValue(
      response({
        playlist: spokenInJapanese,
        timedText: { subtitleUrls: [subtitle("ja-jp", "ForcedNarrative"), subtitle("de-de")] },
      }),
    )
    await primeVideoTrackSource.load("amzn1.dv.gti.1")
    expect(fetchMock).toHaveBeenLastCalledWith(subtitle("de-de").url)
  })

  it("keeps times as they are without a playlist", async () => {
    postMessageRequest.mockResolvedValue(response({ playlist: undefined }))

    const track = await primeVideoTrackSource.load("amzn1.dv.gti.1")

    expect(track.fragments[0]).toMatchObject({ start: 7_208, end: 8_583 })
  })

  it("reports a title without usable subtitles as having none", async () => {
    postMessageRequest.mockResolvedValue(
      response({ timedText: { subtitleUrls: [subtitle("en-us", "ForcedNarrative")] } }),
    )

    await expect(primeVideoTrackSource.load("amzn1.dv.gti.1")).rejects.toBeInstanceOf(
      NoSubtitlesError,
    )
  })

  it("reports a listing or a file it could not read as not loaded", async () => {
    postMessageRequest.mockResolvedValue(response(null))
    await expect(primeVideoTrackSource.load("amzn1.dv.gti.1")).rejects.toBeInstanceOf(
      TrackFileNotLoadedError,
    )

    postMessageRequest.mockResolvedValue(response())
    fetchMock.mockImplementation(async () => new Response("", { status: 403 }))
    await expect(primeVideoTrackSource.load("amzn1.dv.gti.1")).rejects.toBeInstanceOf(
      TrackFileNotLoadedError,
    )
  })

  it("keeps each cue a line of its own, as Netflix does with the same files", () => {
    expect(new TrackSubtitlesFetcher(primeVideoTrackSource).isPreSegmented()).toBe(true)
  })
})
