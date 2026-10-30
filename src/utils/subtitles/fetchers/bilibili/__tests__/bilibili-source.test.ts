// @vitest-environment jsdom

import type { BilibiliSubtitlesResponse } from ".."
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { bilibiliTrackSource } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

const postMessageRequest = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({
  postMessageRequest: (...args: unknown[]) => postMessageRequest(...args),
}))

const HUMAN = { lan: "zh-CN", subtitle_url: "//i0.hdslb.com/bfs/subtitle/zh.json" }
const AI = { lan: "ai-zh", subtitle_url: "//aisubtitle.hdslb.com/bfs/ai_subtitle/zh.json" }
const FILE = {
  body: [
    { from: 3.12, to: 4.34, content: "在我的印象中", music: 0 },
    { from: 0.22, to: 3.12, content: " 这就是刚刚发布的手机 " },
  ],
}

function response(overrides: Partial<BilibiliSubtitlesResponse> = {}): BilibiliSubtitlesResponse {
  return {
    type: "response",
    requestId: "1",
    cid: 42,
    needLogin: false,
    subtitles: [AI, HUMAN],
    ...overrides,
  }
}

const PART_ID = "BV1XZn26rE8x:2"
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  window.history.replaceState(null, "", "/video/BV1XZn26rE8x/?p=2")
  postMessageRequest.mockResolvedValue(response())
  fetchMock.mockResolvedValue(Response.json(FILE))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("bilibiliTrackSource", () => {
  it("keys the track by the video part in the url", () => {
    expect(bilibiliTrackSource.currentKey()).toBe("BV1XZn26rE8x:2")
  })

  it("asks the page for the part and loads the uploader's subtitles, in milliseconds", async () => {
    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toEqual({
      language: "zh-CN",
      fragments: [
        { text: "在我的印象中", start: 3120, end: 4340 },
        { text: " 这就是刚刚发布的手机 ", start: 220, end: 3120 },
      ],
    })
    expect(postMessageRequest.mock.lastCall?.[1]).toMatchObject({ partId: PART_ID })
    expect(fetchMock.mock.lastCall?.[0]).toEqual(
      new URL("https://i0.hdslb.com/bfs/subtitle/zh.json"),
    )
  })

  it("falls back to AI subtitles, skipping entries it cannot read", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: [{ lan: 1 }, AI] }))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "zh" })
  })

  it("asks a signed-out viewer to sign in when the list is empty", async () => {
    postMessageRequest.mockResolvedValue(response({ needLogin: true, subtitles: [] }))

    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.bilibiliLoginRequired",
    )
  })

  it("reports no subtitles when a signed-in viewer's list is empty", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: [] }))

    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toBeInstanceOf(NoSubtitlesError)
  })

  it("reports a timeout when the page never names the part", async () => {
    postMessageRequest.mockResolvedValue(response({ cid: null, subtitles: null }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )

    postMessageRequest.mockResolvedValue(null)
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
  })

  it("reports a load failure when the list or the file cannot be had", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: null }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    postMessageRequest.mockResolvedValue(response())
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    fetchMock.mockResolvedValue(Response.json({ body: "not a list" }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    fetchMock.mockRejectedValue(new TypeError("network"))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )
  })
})
