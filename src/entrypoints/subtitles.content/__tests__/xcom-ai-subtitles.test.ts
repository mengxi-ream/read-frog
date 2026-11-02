import { beforeEach, describe, expect, it, vi } from "vitest"
import { createXcomSubtitlesAdapter } from "../platforms/xcom"
import { getXcomConfig } from "../platforms/xcom/config"

const { getVideoIdMock, getVideoMock } = vi.hoisted(() => ({
  getVideoIdMock: vi.fn<() => string | null>(),
  getVideoMock: vi.fn<() => { duration: number } | null>(),
}))

vi.mock("../platforms/xcom/dom", () => ({
  getCurrentXcomVideoId: getVideoIdMock,
  getCurrentXcomSubtitlesVideo: getVideoMock,
}))

describe("x AI subtitles context", () => {
  const { createAiSubtitlesContext, isLiveContent } = getXcomConfig()

  beforeEach(() => {
    getVideoIdMock.mockReturnValue("1724884212803834154")
    getVideoMock.mockReturnValue({ duration: 341.043 })
  })

  it("names the post by its canonical URL and rounds the player's length up", () => {
    expect(createAiSubtitlesContext?.()).toEqual({
      videoId: "1724884212803834154",
      url: "https://x.com/i/status/1724884212803834154",
      durationSec: 342,
    })
  })

  it("has no context without a post or a playable length", () => {
    getVideoIdMock.mockReturnValue(null)
    expect(createAiSubtitlesContext?.()).toBeNull()

    getVideoIdMock.mockReturnValue("1724884212803834154")
    for (const duration of [Number.NaN, Number.POSITIVE_INFINITY, 0]) {
      getVideoMock.mockReturnValue({ duration })
      expect(createAiSubtitlesContext?.()).toBeNull()
    }
    getVideoMock.mockReturnValue(null)
    expect(createAiSubtitlesContext?.()).toBeNull()
  })

  it("treats a stream without an end as live", async () => {
    getVideoMock.mockReturnValue({ duration: Number.POSITIVE_INFINITY })
    await expect(isLiveContent?.()).resolves.toBe(true)

    getVideoMock.mockReturnValue({ duration: 341.043 })
    await expect(isLiveContent?.()).resolves.toBe(false)

    getVideoMock.mockReturnValue(null)
    await expect(isLiveContent?.()).resolves.toBe(false)
  })

  it("offers AI subtitles on X", () => {
    expect(createXcomSubtitlesAdapter(getXcomConfig()).supportsAiSubtitles).toBe(true)
  })
})
