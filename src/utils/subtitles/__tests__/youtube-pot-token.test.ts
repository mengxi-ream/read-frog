import type { AudioCaptionTrack, CaptionTrack, PlayerData } from "../fetchers/youtube/types"
import { describe, expect, it } from "vitest"
import { extractPotToken } from "../fetchers/youtube/pot-token"

const VIDEO_ID = "SfcUVFzKRBY"
const AD_VIDEO_ID = "adVideo0001"

const jaAsrTrack: CaptionTrack = {
  baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=ja&kind=asr`,
  languageCode: "ja",
  kind: "asr",
  vssId: "a.ja",
}

function audioTrack(videoId: string, vssId: string, pot: string): AudioCaptionTrack {
  const languageCode = vssId.split(".")[1]!
  const kind = vssId.startsWith("a.") ? "asr" : undefined
  return {
    url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${languageCode}${kind ? "&kind=asr" : ""}&exp=xpe&pot=${pot}&potc=1`,
    vssId,
    kind,
    languageCode,
  }
}

function playerData(overrides: Partial<PlayerData>): PlayerData {
  return {
    videoId: VIDEO_ID,
    captionTracks: [jaAsrTrack],
    audioCaptionTracks: [],
    device: null,
    cver: null,
    playerState: 1,
    selectedTrackLanguageCode: "ja",
    selectedTrackVssId: "a.ja",
    defaultCaptionTrackIndex: null,
    cachedTimedtextUrl: null,
    isLiveContent: false,
    ...overrides,
  }
}

describe("extractPotToken", () => {
  it("takes the token from the selected track of this video", () => {
    const data = playerData({ audioCaptionTracks: [audioTrack(VIDEO_ID, "a.ja", "OWN")] })

    expect(extractPotToken(jaAsrTrack, data)).toEqual({ pot: "OWN", potc: "1" })
  })

  // During a pre-roll ad the player's audio track is the ad's, with the ad's own captions.
  it("does not borrow the token of an ad's unrelated caption track", () => {
    const data = playerData({ audioCaptionTracks: [audioTrack(AD_VIDEO_ID, ".en", "AD")] })

    expect(extractPotToken(jaAsrTrack, data)).toEqual({ pot: null, potc: null })
  })

  it("does not borrow an ad's token even when its track looks like the selected one", () => {
    const data = playerData({ audioCaptionTracks: [audioTrack(AD_VIDEO_ID, "a.ja", "AD")] })

    expect(extractPotToken(jaAsrTrack, data)).toEqual({ pot: null, potc: null })
  })

  it("prefers this video's track over an ad's when both are present", () => {
    const data = playerData({
      audioCaptionTracks: [
        audioTrack(AD_VIDEO_ID, "a.ja", "AD"),
        audioTrack(VIDEO_ID, ".en", "OWN"),
      ],
    })

    expect(extractPotToken(jaAsrTrack, data)).toEqual({ pot: "OWN", potc: "1" })
  })

  it("falls back to the timedtext request the page made for this video", () => {
    const data = playerData({
      audioCaptionTracks: [audioTrack(AD_VIDEO_ID, ".en", "AD")],
      cachedTimedtextUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=ja&pot=CACHED&potc=1`,
    })

    expect(extractPotToken(jaAsrTrack, data)).toEqual({ pot: "CACHED", potc: "1" })
  })
})
