import { beforeEach, describe, expect, it, vi } from "vitest"
import { getBilibiliConfig } from "../config"

const BVID = "BV1nuyWz8Eji"
const CID = 43764813122

const mocks = vi.hoisted(() => ({
  partId: null as string | null,
  part: null as { bvid: string; cid: number; p: number } | null,
  video: null as { duration: number } | null,
}))

vi.mock("@/utils/subtitles/video-id", () => ({ getBilibiliPartId: () => mocks.partId }))
vi.mock("@/utils/subtitles/fetchers/bilibili/playing-part", () => ({
  requestBilibiliPlayingPart: async () => mocks.part,
}))

describe("bilibili AI subtitles", () => {
  const { createAiSubtitlesContext } = getBilibiliConfig()

  beforeEach(() => {
    mocks.partId = `${BVID}:4`
    mocks.part = { bvid: BVID, cid: CID, p: 4 }
    mocks.video = { duration: 659.968 }
    vi.stubGlobal("document", { querySelector: () => mocks.video })
  })

  it("names the playing part by its cid, under its BV page", async () => {
    await expect(createAiSubtitlesContext?.()).resolves.toEqual({
      videoId: String(CID),
      url: `https://www.bilibili.com/video/${BVID}/?p=4`,
      durationSec: 660,
      mediaId: String(CID),
    })
  })

  it("sends an av page's part under its BV page", async () => {
    mocks.partId = "av114514:4"

    await expect(createAiSubtitlesContext?.()).resolves.toMatchObject({
      url: `https://www.bilibili.com/video/${BVID}/?p=4`,
    })
  })

  it("has no context before the player plays the part, off a video page, or without a video", async () => {
    mocks.part = null
    await expect(createAiSubtitlesContext?.()).resolves.toBeNull()

    mocks.part = { bvid: BVID, cid: CID, p: 4 }
    mocks.partId = null
    await expect(createAiSubtitlesContext?.()).resolves.toBeNull()

    mocks.partId = `${BVID}:4`
    mocks.video = null
    await expect(createAiSubtitlesContext?.()).resolves.toBeNull()
  })
})
