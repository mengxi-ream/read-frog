import { xcomPostVideoKey } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import { resolveAiSubtitlesContext } from "../ai-subtitles-context"

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"
const X_STATUS_ID = "2119833829389041896"
const X_POST_URL = `https://x.com/NASA/status/${X_STATUS_ID}`
const MEDIA_ID = "2119833138889158657"
const video = { duration: 341.043 }

describe("resolveAiSubtitlesContext", () => {
  it.each([
    YOUTUBE_URL,
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])("keys %s by its v id, keeps the URL as given and rounds the length up", (url) => {
    expect(resolveAiSubtitlesContext({ url, video })).toEqual({
      videoId: "dQw4w9WgXcQ",
      url,
      durationSec: 342,
    })
  })

  it("keys an X post by the media id of the video it plays", () => {
    expect(resolveAiSubtitlesContext({ url: X_POST_URL, mediaId: MEDIA_ID, video })).toEqual({
      videoId: MEDIA_ID,
      url: X_POST_URL,
      durationSec: 342,
      mediaId: MEDIA_ID,
    })
  })

  it("keys an X post without a media id by the post", () => {
    expect(resolveAiSubtitlesContext({ url: X_POST_URL, video })).toEqual({
      videoId: xcomPostVideoKey(X_STATUS_ID),
      url: X_POST_URL,
      durationSec: 342,
    })
  })

  it.each([
    { url: X_POST_URL, mediaId: "0123" },
    { url: "https://vimeo.com/76979871", mediaId: MEDIA_ID },
    { url: "not-a-url" },
  ])("has no context for $url with media id $mediaId", (request) => {
    expect(resolveAiSubtitlesContext({ ...request, video })).toBeNull()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0])(
    "has no context for a length of %s",
    (duration) => {
      expect(resolveAiSubtitlesContext({ url: YOUTUBE_URL, video: { duration } })).toBeNull()
    },
  )

  it("has no context without a video", () => {
    expect(resolveAiSubtitlesContext({ url: YOUTUBE_URL, video: null })).toBeNull()
  })
})
