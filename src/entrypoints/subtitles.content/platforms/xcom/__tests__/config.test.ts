import { beforeEach, describe, expect, it, vi } from "vitest"
import { createXcomSubtitlesAdapter } from ".."
import { getXcomConfig } from "../config"

const STATUS_ID = "1724884212803834154"
const MEDIA_ID = "1724883339285544960"
const POST_URL = `https://x.com/i/status/${STATUS_ID}`
const POSTER = `https://pbs.twimg.com/amplify_video_thumb/${MEDIA_ID}/img/a.jpg`
const GIF_POSTER = "https://pbs.twimg.com/tweet_video_thumb/HWsq49ZW0AAo02a.jpg"

const mocks = vi.hoisted(() => ({
  video: null as { duration: number; poster: string } | null,
  url: null as string | null,
}))

vi.mock("../dom", () => ({
  getCurrentXcomSubtitlesVideo: () => mocks.video,
  getCurrentXcomVideoUrl: () => mocks.url,
  getCurrentXcomVideoId: () => null,
  getXcomVideoPostUrl: () => mocks.url,
}))

describe("x AI subtitles", () => {
  const { createAiSubtitlesContext, isLiveContent } = getXcomConfig()

  beforeEach(() => {
    mocks.url = POST_URL
    mocks.video = { duration: 341.043, poster: POSTER }
  })

  it("names the played video by its poster's media id, under its post link", () => {
    expect(createAiSubtitlesContext?.()).toEqual({
      videoId: MEDIA_ID,
      url: POST_URL,
      durationSec: 342,
      mediaId: MEDIA_ID,
    })
  })

  it.each(["", GIF_POSTER])("has no context for the poster %j", (poster) => {
    mocks.video = { duration: 341.043, poster }
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it("has no context without a post link or a video", () => {
    mocks.url = null
    expect(createAiSubtitlesContext?.()).toBeNull()

    mocks.url = POST_URL
    mocks.video = null
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it("treats only a video without an end as live", async () => {
    mocks.video = { duration: Number.POSITIVE_INFINITY, poster: POSTER }
    await expect(isLiveContent?.()).resolves.toBe(true)

    mocks.video = { duration: 341.043, poster: POSTER }
    await expect(isLiveContent?.()).resolves.toBe(false)

    mocks.video = null
    await expect(isLiveContent?.()).resolves.toBe(false)
  })

  it("supports AI subtitles on X", () => {
    expect(createXcomSubtitlesAdapter(getXcomConfig()).supportsAiSubtitles).toBe(true)
  })
})
