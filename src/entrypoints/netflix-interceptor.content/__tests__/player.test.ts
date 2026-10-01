// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  NETFLIX_SUBTITLES_REQUEST_TYPE,
  NETFLIX_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { listenForSubtitlesRequests } from "../player"

vi.mock("../ttml-capture", () => ({ findCapturedTtml: () => "<tt/>" }))

const track = (trackId: string, bcp47: string | null, flags: Partial<{ none: boolean }> = {}) => ({
  trackId,
  bcp47,
  isNoneTrack: !!flags.none,
  isForcedNarrative: false,
})

const OFF = track("off", null, { none: true })
const ZH = track("zh-Hant", "zh-Hant")
const EN = track("en", "en")

let current = OFF

beforeAll(() => {
  const player = {
    getMovieId: () => 1,
    getAudioTrack: () => ({ bcp47: "zh-CN" }),
    getTimedTextTrack: () => current,
    getTimedTextTrackList: () => [OFF, ZH, EN],
    setTimedTextTrack: (next: typeof current) => {
      current = next
    },
  }
  ;(window as any).netflix = {
    appContext: {
      state: {
        playerApp: {
          getAPI: () => ({
            videoPlayer: {
              getAllPlayerSessionIds: () => ["watch-1"],
              getVideoPlayerBySessionId: () => player,
            },
          }),
        },
      },
    },
  }
  listenForSubtitlesRequests()
})

function request(action: "load" | "restore"): Promise<any> {
  return new Promise((resolve) => {
    const requestId = Math.random().toString()
    const handler = (event: MessageEvent) => {
      if (
        event.data?.type === NETFLIX_SUBTITLES_RESPONSE_TYPE &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler)
        resolve(event.data)
      }
    }
    window.addEventListener("message", handler)
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: NETFLIX_SUBTITLES_REQUEST_TYPE, requestId, action },
        origin: window.location.origin,
      }),
    )
  })
}

describe("Netflix player requests", () => {
  beforeEach(() => {
    current = OFF
  })

  it("picks the audio-language track and puts Off back on restore", async () => {
    await expect(request("load")).resolves.toMatchObject({ trackId: "zh-Hant", ttml: "<tt/>" })

    await request("restore")

    expect(current).toBe(OFF)
  })

  it("keeps a track the viewer chose after Read Frog picked one", async () => {
    await request("load")
    current = EN
    await expect(request("load")).resolves.toMatchObject({ trackId: "en" })

    await request("restore")

    expect(current).toBe(EN)
  })
})
