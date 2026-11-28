// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  PRIME_VIDEO_SUBTITLES_REQUEST_TYPE,
  PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import {
  findTitleIdByDuration,
  recordPlaybackResources,
  setupPlaybackResourcesCapture,
} from "../playback-resources"
import { listenForSubtitlesRequests, markUnmarkedVideo, watchPlayingTitle } from "../player"

const RESOURCES_URL = "https://atv-ps.amazon.com/playback/prs/GetVodPlaybackResources?titleId="
let title = 0

// Each test lists its own titles and lengths: the page script keeps what it captured for the page.
function nextTitleId(): string {
  title += 1
  return `amzn1.dv.gti.${title}`
}

function resources(durationMs: number, withSubtitles = true) {
  return {
    timedTextUrls: withSubtitles ? { result: { subtitleUrls: [] } } : { error: "Invalid" },
    vodPlaylistedPlaybackUrls: {
      result: { playbackUrls: { fullTitleDurationMs: durationMs, intraTitlePlaylist: [] } },
    },
  }
}

function playerVideo(): HTMLVideoElement {
  document.body.innerHTML = `<div id="dv-web-player"><video></video></div>`
  return document.querySelector("video")!
}

function setDuration(video: HTMLVideoElement, seconds: number, event = "durationchange") {
  Object.defineProperty(video, "duration", { configurable: true, value: seconds })
  video.dispatchEvent(new Event(event))
}

beforeAll(() => {
  watchPlayingTitle()
  listenForSubtitlesRequests()
})

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("findTitleIdByDuration", () => {
  it("names the latest title asked for that is as long as the video", () => {
    const playing = nextTitleId()
    const nextEpisode = nextTitleId()
    recordPlaybackResources(playing, resources(70_000_000))
    recordPlaybackResources(nextEpisode, resources(70_000_000))
    // Prime asks for the title again as it starts playing it.
    recordPlaybackResources(playing, resources(70_000_000))

    expect(findTitleIdByDuration(70_000_400)).toBe(playing)
    expect(findTitleIdByDuration(70_002_000)).toBeNull()
  })

  it("never takes a trailer, whose resources list no subtitles", () => {
    recordPlaybackResources(nextTitleId(), resources(15_015, false))

    expect(findTitleIdByDuration(15_015)).toBeNull()
  })
})

describe("the player's video", () => {
  it("is marked with the title it plays, and unmarked when its source empties", () => {
    const titleId = nextTitleId()
    recordPlaybackResources(titleId, resources(4_419_000))
    const video = playerVideo()

    setDuration(video, 4419)
    expect(video.getAttribute("data-read-frog-title-id")).toBe(titleId)

    setDuration(video, Number.NaN, "emptied")
    expect(video.hasAttribute("data-read-frog-title-id")).toBe(false)
  })

  it("is marked once its title's resources arrive after its length", () => {
    const video = playerVideo()
    setDuration(video, 3495)
    expect(video.hasAttribute("data-read-frog-title-id")).toBe(false)

    const titleId = nextTitleId()
    recordPlaybackResources(titleId, resources(3_495_000))
    markUnmarkedVideo()

    expect(video.getAttribute("data-read-frog-title-id")).toBe(titleId)
  })

  it("is marked again with the next title when its length changes", () => {
    const first = nextTitleId()
    const next = nextTitleId()
    recordPlaybackResources(first, resources(2_640_000))
    recordPlaybackResources(next, resources(2_580_000))
    const video = playerVideo()

    setDuration(video, 2640)
    setDuration(video, 2580)

    expect(video.getAttribute("data-read-frog-title-id")).toBe(next)
  })

  it("keeps its title when an equally long one is asked for later", () => {
    const playing = nextTitleId()
    recordPlaybackResources(playing, resources(1_440_000))
    const video = playerVideo()
    setDuration(video, 1440)

    recordPlaybackResources(nextTitleId(), resources(1_440_000))
    markUnmarkedVideo()

    expect(video.getAttribute("data-read-frog-title-id")).toBe(playing)
  })

  it("leaves a video outside the player alone", () => {
    recordPlaybackResources(nextTitleId(), resources(17_000))
    document.body.innerHTML = `<video></video>`
    const trailer = document.querySelector("video")!

    setDuration(trailer, 17)

    expect(trailer.hasAttribute("data-read-frog-title-id")).toBe(false)
  })
})

describe("setupPlaybackResourcesCapture", () => {
  it("records what the player is sent and hands the player its own response", async () => {
    const titleId = nextTitleId()
    const playerResponse = Response.json(resources(2_000_000))
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(playerResponse))
    const onRecorded = vi.fn<() => void>()
    setupPlaybackResourcesCapture(onRecorded)

    const received = await window.fetch(`${RESOURCES_URL}${titleId}`, { method: "POST" })

    expect(received).toBe(playerResponse)
    await vi.waitFor(() => expect(onRecorded).toHaveBeenCalled())
    expect(findTitleIdByDuration(2_000_000)).toBe(titleId)
    expect(await received.json()).toEqual(resources(2_000_000))
  })
})

describe("listenForSubtitlesRequests", () => {
  it("answers with what was captured for the title", async () => {
    const titleId = nextTitleId()
    recordPlaybackResources(titleId, resources(1_000_000))
    // jsdom posts messages without an origin, and both ends of the bridge check it.
    vi.spyOn(window, "postMessage").mockImplementation((data: unknown) => {
      setTimeout(() => {
        window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }))
      })
    })

    const reply = new Promise<any>((resolve) => {
      window.addEventListener("message", (event) => {
        if (event.data?.type === PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE) resolve(event.data)
      })
    })
    window.postMessage({ type: PRIME_VIDEO_SUBTITLES_REQUEST_TYPE, requestId: "1", titleId })

    expect(await reply).toEqual({
      type: PRIME_VIDEO_SUBTITLES_RESPONSE_TYPE,
      requestId: "1",
      resources: { durationMs: 1_000_000, timedText: { subtitleUrls: [] }, playlist: [] },
    })
  })
})
