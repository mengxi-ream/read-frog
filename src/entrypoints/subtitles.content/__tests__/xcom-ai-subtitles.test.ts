import { beforeEach, describe, expect, it, vi } from "vitest"
import { createXcomSubtitlesAdapter } from "../platforms/xcom"
import { getXcomConfig } from "../platforms/xcom/config"

const { getVideoIdMock, getVideoMock } = vi.hoisted(() => ({
  getVideoIdMock: vi.fn<() => string | null>(),
  getVideoMock: vi.fn<() => { duration: number; poster: string } | null>(),
}))

const MEDIA_ID = "1724883339285544960"
const POSTER = `https://pbs.twimg.com/amplify_video_thumb/${MEDIA_ID}/img/a.jpg`

vi.mock("../platforms/xcom/dom", () => ({
  getCurrentXcomVideoId: getVideoIdMock,
  getCurrentXcomSubtitlesVideo: getVideoMock,
}))

describe("x AI subtitles context", () => {
  const { createAiSubtitlesContext, isLiveContent } = getXcomConfig()

  beforeEach(() => {
    getVideoIdMock.mockReturnValue("1724884212803834154")
    getVideoMock.mockReturnValue({ duration: 341.043, poster: POSTER })
  })

  it("names the video by its poster's media id, under the post's canonical URL", () => {
    expect(createAiSubtitlesContext?.()).toEqual({
      videoId: MEDIA_ID,
      url: "https://x.com/i/status/1724884212803834154",
      durationSec: 342,
      mediaId: MEDIA_ID,
    })
  })

  it("has no context without a post, a media id or a playable length", () => {
    getVideoIdMock.mockReturnValue(null)
    expect(createAiSubtitlesContext?.()).toBeNull()

    getVideoIdMock.mockReturnValue("1724884212803834154")
    for (const poster of ["", "https://pbs.twimg.com/tweet_video_thumb/HWsq49ZW0AAo02a.jpg"]) {
      getVideoMock.mockReturnValue({ duration: 341.043, poster })
      expect(createAiSubtitlesContext?.()).toBeNull()
    }
    for (const duration of [Number.NaN, Number.POSITIVE_INFINITY, 0]) {
      getVideoMock.mockReturnValue({ duration, poster: POSTER })
      expect(createAiSubtitlesContext?.()).toBeNull()
    }
    getVideoMock.mockReturnValue(null)
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it("treats a stream without an end as live", async () => {
    getVideoMock.mockReturnValue({ duration: Number.POSITIVE_INFINITY, poster: POSTER })
    await expect(isLiveContent?.()).resolves.toBe(true)

    getVideoMock.mockReturnValue({ duration: 341.043, poster: POSTER })
    await expect(isLiveContent?.()).resolves.toBe(false)

    getVideoMock.mockReturnValue(null)
    await expect(isLiveContent?.()).resolves.toBe(false)
  })

  it("offers AI subtitles on X", () => {
    expect(createXcomSubtitlesAdapter(getXcomConfig()).supportsAiSubtitles).toBe(true)
  })
})
