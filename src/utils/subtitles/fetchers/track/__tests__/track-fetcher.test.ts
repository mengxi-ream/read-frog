import type { SubtitlesTrackSource } from ".."
import { describe, expect, it, vi } from "vitest"
import { NoSubtitlesError, OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { TrackSubtitlesFetcher } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

function source() {
  const trackSource = {
    key: "video:1" as string | null,
    currentKey: () => trackSource.key,
    load: vi.fn<SubtitlesTrackSource["load"]>(async () => ({
      language: "en",
      fragments: [
        { text: " second ", start: 1000, end: 2000 },
        { text: "first", start: 0, end: 1000 },
        { text: "  ", start: 2000, end: 3000 },
      ],
    })),
  }
  return trackSource
}

describe("TrackSubtitlesFetcher", () => {
  it("loads the track the page is on, cleaned and in time order", async () => {
    const trackSource = source()
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "first", start: 0, end: 1000 },
      { text: "second", start: 1000, end: 2000 },
    ])
    expect(trackSource.load).toHaveBeenCalledWith("video:1")
    expect(fetcher.getSourceLanguage()).toBe("en")
  })

  it("reports no subtitles off a video, without asking the source", async () => {
    const trackSource = source()
    trackSource.key = null
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(false)
    await expect(fetcher.fetch()).rejects.toBeInstanceOf(NoSubtitlesError)
    expect(trackSource.load).not.toHaveBeenCalled()
  })

  it("checks for subtitles by loading the track, and fetches from that same load", async () => {
    const trackSource = source()
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(true)
    await expect(fetcher.fetch()).resolves.toHaveLength(2)
    expect(trackSource.load).toHaveBeenCalledTimes(1)
  })

  it("reports no subtitles when the source finds none in the track", async () => {
    const trackSource = source()
    trackSource.load.mockRejectedValueOnce(new NoSubtitlesError())
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(false)
  })

  it("reports no subtitles when every line of the track is blank", async () => {
    const trackSource = source()
    trackSource.load.mockResolvedValueOnce({
      language: "en-US",
      fragments: [{ text: "", start: 333, end: 5333 }],
    })
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(false)
  })

  it("leaves any other failure for fetch to report, then asks the source again", async () => {
    const trackSource = source()
    const error = new OverlaySubtitlesError("subtitles.errors.trackFileNotLoaded")
    trackSource.load.mockRejectedValueOnce(error)
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(true)
    await expect(fetcher.fetch()).rejects.toBe(error)
    await expect(fetcher.fetch()).resolves.toHaveLength(2)
    expect(trackSource.load).toHaveBeenCalledTimes(2)
  })

  it("keeps the loaded track until the page moves to another one", async () => {
    const trackSource = source()
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
    await fetcher.fetch()
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)

    trackSource.key = "video:2"
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })

  it("forgets the loaded track on cleanup", async () => {
    const fetcher = new TrackSubtitlesFetcher(source())
    await fetcher.fetch()

    fetcher.cleanup()

    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
    expect(fetcher.getSourceLanguage()).toBe("")
  })

  it("passes on the error a source throws", async () => {
    const trackSource = source()
    const error = new OverlaySubtitlesError("subtitles.errors.trackFileNotLoaded")
    trackSource.load.mockRejectedValueOnce(error)
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    await expect(fetcher.fetch()).rejects.toBe(error)
  })

  it("stays on a track whose load is running or failed, so a track poll does not ask again", async () => {
    const trackSource = source()
    const load = Promise.withResolvers<never>()
    trackSource.load.mockReturnValueOnce(load.promise)
    const fetcher = new TrackSubtitlesFetcher(trackSource)

    const fetching = fetcher.fetch()
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)

    load.reject(new NoSubtitlesError())
    await expect(fetching).rejects.toBeInstanceOf(NoSubtitlesError)
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)
    expect(trackSource.load).toHaveBeenCalledTimes(1)

    trackSource.key = "video:2"
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })
})
