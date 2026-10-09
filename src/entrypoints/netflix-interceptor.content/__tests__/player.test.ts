// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS,
  NETFLIX_LOAD_TIMEOUT_MS,
  NETFLIX_SUBTITLES_REQUEST_TYPE,
  NETFLIX_SUBTITLES_RESPONSE_TYPE,
  POST_MESSAGE_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { NetflixSubtitlesFetcher } from "@/utils/subtitles/fetchers/netflix"
import { listenForSubtitlesRequests } from "../player"

const capture = vi.hoisted(() => ({ ttml: null as string | null }))
vi.mock("../ttml-capture", () => ({ findCapturedTtml: () => capture.ttml }))

const TTML = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000" xml:lang="en">
<body><div><p begin="10000000t" end="20000000t">Hello there.</p></div></body>
</tt>`

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
let playerReady = true

const player = {
  getMovieId: () => 1,
  getAudioTrack: () => ({ bcp47: "zh-CN" }),
  getTimedTextTrack: () => current,
  getTimedTextTrackList: () => (playerReady ? [OFF, ZH, EN] : []),
  setTimedTextTrack: (next: typeof current) => {
    current = next
  },
}

beforeAll(() => {
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

beforeEach(() => {
  current = OFF
  playerReady = true
  capture.ttml = TTML
  // jsdom posts messages without an origin, and both ends of the bridge check it.
  vi.spyOn(window, "postMessage").mockImplementation((data: unknown) => {
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }))
    })
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function request(action: "state" | "load" | "restore"): Promise<any> {
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
  it("picks the audio-language track and puts Off back on restore", async () => {
    await expect(request("load")).resolves.toMatchObject({ trackId: "zh-Hant", ttml: TTML })

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

  it("still answers when reading the player throws", async () => {
    vi.spyOn(player, "getMovieId").mockImplementationOnce(() => {
      throw new Error("player torn down")
    })

    await expect(request("load")).resolves.toMatchObject({ movieId: null, ttml: null })
  })

  it("answers a state check before the content script's usual wait runs out", async () => {
    vi.useFakeTimers()
    playerReady = false
    const start = Date.now()
    let answeredAfterMs: number | undefined
    void request("state").then(() => {
      answeredAfterMs = Date.now() - start
    })

    await vi.advanceTimersByTimeAsync(POST_MESSAGE_TIMEOUT_MS)

    expect(answeredAfterMs).toBeLessThan(POST_MESSAGE_TIMEOUT_MS)
  })
})

describe("Netflix subtitle loads from the fetcher to the page and back", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    playerReady = false
    capture.ttml = null
  })

  function playerReadyAt(ms: number) {
    setTimeout(() => {
      playerReady = true
    }, ms)
  }

  function fileCapturedAt(ms: number) {
    setTimeout(() => {
      capture.ttml = TTML
    }, ms)
  }

  // What the viewer ends up with, once the content script has waited as long as it ever will.
  async function load(): Promise<{ message: string; ms: number }> {
    const start = Date.now()
    const outcome = new NetflixSubtitlesFetcher()
      .fetch()
      .then(
        () => "loaded",
        (error: Error) => error.message,
      )
      .then((message) => ({ message, ms: Date.now() - start }))
    await vi.advanceTimersByTimeAsync(NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS)
    return outcome
  }

  it("keeps waiting for a slow player and a late subtitle file", async () => {
    playerReadyAt(3000)
    fileCapturedAt(6500)

    const { message, ms } = await load()

    expect(message).toBe("loaded")
    expect(ms).toBeGreaterThan(POST_MESSAGE_TIMEOUT_MS)
  })

  it.each([500, 2000, 9000])(
    "reports a file that never arrives the same way when the player is ready at %i ms",
    async (readyAtMs) => {
      playerReadyAt(readyAtMs)

      const { message, ms } = await load()

      expect(message).toBe("subtitles.errors.trackFileNotLoaded")
      expect(ms).toBeGreaterThanOrEqual(NETFLIX_LOAD_TIMEOUT_MS)
      expect(ms).toBeLessThan(NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS)
    },
  )

  it("hears from the page that the player never became ready, and reports a timeout", async () => {
    const { message, ms } = await load()

    expect(message).toBe("subtitles.errors.fetchSubTimeout")
    expect(ms).toBeGreaterThanOrEqual(NETFLIX_LOAD_TIMEOUT_MS)
    expect(ms).toBeLessThan(NETFLIX_LOAD_POST_MESSAGE_TIMEOUT_MS)
  })
})
