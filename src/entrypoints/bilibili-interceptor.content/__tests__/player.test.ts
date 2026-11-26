// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  BILIBILI_PAGE_POLL_INTERVAL_MS,
  BILIBILI_PAGE_WAIT_TIMEOUT_MS,
  BILIBILI_SUBTITLES_REQUEST_TYPE,
  BILIBILI_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { listenForSubtitlesRequests } from "../player"
import { findCapturedSubtitles, recordPlayerInfo } from "../player-info-capture"

const SUBTITLES = [{ lan: "ai-zh", subtitle_url: "//aisubtitle.hdslb.com/bfs/ai_subtitle/zh.json" }]
const PAST_PAGE_WAIT = BILIBILI_PAGE_WAIT_TIMEOUT_MS + BILIBILI_PAGE_POLL_INTERVAL_MS

let cid = 0
let manifest: () => object

function playerInfo(subtitles: object[] = SUBTITLES) {
  return { data: { cid, subtitle: { subtitles } } }
}

beforeAll(() => {
  ;(window as any).player = { getManifest: () => manifest() }
  listenForSubtitlesRequests()
})

beforeEach(() => {
  cid += 1
  manifest = () => ({ cid, bvid: "BV1XZn26rE8x", aid: 170001, p: 1 })
  // jsdom posts messages without an origin, and both ends of the bridge check it.
  vi.spyOn(window, "postMessage").mockImplementation((data: unknown) => {
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }))
    })
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function request(partId = "BV1XZn26rE8x:1"): Promise<any> {
  return new Promise((resolve) => {
    const requestId = Math.random().toString()
    const handler = (event: MessageEvent) => {
      if (
        event.data?.type === BILIBILI_SUBTITLES_RESPONSE_TYPE &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler)
        resolve(event.data)
      }
    }
    window.addEventListener("message", handler)
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: BILIBILI_SUBTITLES_REQUEST_TYPE, requestId, partId },
        origin: window.location.origin,
      }),
    )
  })
}

describe("recordPlayerInfo", () => {
  it("keeps the subtitle list of a player response by its cid", () => {
    recordPlayerInfo(playerInfo())

    expect(findCapturedSubtitles(cid)).toEqual(SUBTITLES)
  })

  it("ignores responses that are not player info", () => {
    recordPlayerInfo({ code: -400, data: null })
    recordPlayerInfo({ data: { cid } })

    expect(findCapturedSubtitles(cid)).toBeNull()
  })
})

describe("Bilibili subtitle requests", () => {
  it("answers with the subtitle list the player got for the part", async () => {
    recordPlayerInfo(playerInfo([]))

    await expect(request()).resolves.toMatchObject({ cid, subtitles: [] })
  })

  it("names an av-numbered part the way the url does", async () => {
    recordPlayerInfo(playerInfo())

    await expect(request("av170001:1")).resolves.toMatchObject({ cid, subtitles: SUBTITLES })
  })

  it("waits for the player to reach the part the url names", async () => {
    vi.useFakeTimers()
    recordPlayerInfo(playerInfo([]))
    const firstPartCid = cid
    cid += 1
    recordPlayerInfo(playerInfo())
    let switched = false
    manifest = () => ({
      cid: switched ? cid : firstPartCid,
      bvid: "BV1XZn26rE8x",
      aid: 1,
      p: switched ? 2 : 1,
    })

    const response = request("BV1XZn26rE8x:2")
    await vi.advanceTimersByTimeAsync(BILIBILI_PAGE_POLL_INTERVAL_MS * 2)
    switched = true
    await vi.advanceTimersByTimeAsync(BILIBILI_PAGE_POLL_INTERVAL_MS * 2)

    await expect(response).resolves.toMatchObject({ cid, subtitles: SUBTITLES })
  })

  it("keeps polling while the player is still starting", async () => {
    vi.useFakeTimers()
    recordPlayerInfo(playerInfo())
    let polls = 0
    manifest = () => {
      if (polls++ < 2) throw new Error("player not ready")
      return { cid, bvid: "BV1XZn26rE8x", aid: 1, p: 1 }
    }

    const response = request()
    await vi.advanceTimersByTimeAsync(BILIBILI_PAGE_POLL_INTERVAL_MS * 3)

    await expect(response).resolves.toMatchObject({ cid, subtitles: SUBTITLES })
  })

  it("asks again with the player's own signed request when it was not captured", async () => {
    vi.useFakeTimers()
    const signedUrl = `https://api.bilibili.com/x/player/wbi/v2?aid=1&cid=${cid}&w_rid=abc`
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: `https://api.bilibili.com/x/player/wbi/v2?aid=1&cid=${cid + 1}&w_rid=other` },
      { name: signedUrl },
    ] as PerformanceEntryList)
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(playerInfo()))
    vi.stubGlobal("fetch", fetchMock)

    const response = request()
    await vi.advanceTimersByTimeAsync(PAST_PAGE_WAIT)

    await expect(response).resolves.toMatchObject({ cid, subtitles: SUBTITLES })
    expect(fetchMock).toHaveBeenCalledWith(
      signedUrl,
      expect.objectContaining({ credentials: "include" }),
    )
  })

  it("names the part but no list when asking again fails", async () => {
    vi.useFakeTimers()
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&w_rid=abc` },
    ] as PerformanceEntryList)
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response("<html>blocked</html>", { status: 412 })),
    )

    const response = request()
    await vi.advanceTimersByTimeAsync(PAST_PAGE_WAIT)

    await expect(response).resolves.toMatchObject({ cid, subtitles: null })
  })

  it("names no part when the player never reaches it", async () => {
    vi.useFakeTimers()

    const response = request("BV1XZn26rE8x:9")
    await vi.advanceTimersByTimeAsync(PAST_PAGE_WAIT)

    await expect(response).resolves.toMatchObject({ cid: null, subtitles: null })
  })
})
