import { xcomPostVideoKey } from "@read-frog/definitions"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createXcomSubtitlesAdapter } from ".."
import { getXcomConfig } from "../config"

const STATUS_ID = "1724884212803834154"
const MEDIA_ID = "1724883339285544960"
const POST_URL = `https://x.com/i/status/${STATUS_ID}`
// A reply's page names the reply, not the post above it that holds the video.
const PAGE_URL = "https://x.com/i/status/1724885031099367936"
const POSTER = `https://pbs.twimg.com/amplify_video_thumb/${MEDIA_ID}/img/a.jpg`
const GIF_POSTER = "https://pbs.twimg.com/tweet_video_thumb/HWsq49ZW0AAo02a.jpg"
const CUSTOM_COVER_POSTER = "https://pbs.twimg.com/media/HXk_T7cWcAAEUL9.jpg"
const REPLAY_POSTER =
  "https://prod-fastly-p.video.pscp.tv/Transcoding/v1/replay_thumbnail/pdxa/periscope-replays-public/eyJkIjowfQ/2"
const LIVE_POSTER =
  "https://prod-fastly-p.video.pscp.tv/Transcoding/v1/live_thumbnail/pdxa/eyJkIjowfQ"

const mocks = vi.hoisted(() => ({
  video: null as { duration: number; poster: string } | null,
  postUrl: null as string | null,
}))

vi.mock("../dom", () => ({
  getCurrentXcomSubtitlesVideo: () => mocks.video,
  getCurrentXcomVideoUrl: () => PAGE_URL,
  getCurrentXcomVideoId: () => null,
  getXcomVideoPostUrl: () => mocks.postUrl,
}))

describe("x AI subtitles", () => {
  const { createAiSubtitlesContext, isLiveContent } = getXcomConfig()

  beforeEach(() => {
    mocks.postUrl = POST_URL
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

  it.each([CUSTOM_COVER_POSTER, REPLAY_POSTER, ""])(
    "names the only video of the post holding it when the poster %j holds no media id",
    (poster) => {
      mocks.video = { duration: 341.043, poster }
      expect(createAiSubtitlesContext?.()).toEqual({
        videoId: xcomPostVideoKey(STATUS_ID),
        url: POST_URL,
        durationSec: 342,
      })
    },
  )

  it("has no context for a GIF, which X plays as a silent video", () => {
    mocks.video = { duration: 341.043, poster: GIF_POSTER }
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it("has no context without a post link, even on a post's page, or without a video", () => {
    mocks.postUrl = null
    expect(createAiSubtitlesContext?.()).toBeNull()

    mocks.postUrl = POST_URL
    mocks.video = null
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it.each([
    { live: "without an end", video: { duration: Number.POSITIVE_INFINITY, poster: POSTER } },
    // As read on x.com: a broadcast still live had 47.354s, then 56.394s eight seconds later.
    { live: "with a live poster", video: { duration: 47.354, poster: LIVE_POSTER } },
  ])("treats a video $live as live, with no context", async ({ video }) => {
    mocks.video = video
    await expect(isLiveContent?.()).resolves.toBe(true)
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it("tells a reader refused while a broadcast is live that its replay will work", () => {
    expect(getXcomConfig().liveContentMessage?.()).toBe("subtitles.errors.aiLiveStreamUnsupported")
  })

  it("treats a broadcast's replay, or no video, as not live", async () => {
    mocks.video = { duration: 2656.62, poster: REPLAY_POSTER }
    await expect(isLiveContent?.()).resolves.toBe(false)

    mocks.video = null
    await expect(isLiveContent?.()).resolves.toBe(false)
  })

  it("supports AI subtitles on X", () => {
    expect(createXcomSubtitlesAdapter(getXcomConfig()).supportsAiSubtitles).toBe(true)
  })
})
