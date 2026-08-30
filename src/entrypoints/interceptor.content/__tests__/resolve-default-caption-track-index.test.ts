import { describe, expect, it } from "vitest"
import { resolveDefaultCaptionTrackIndex } from "../utils"

describe("resolveDefaultCaptionTrackIndex", () => {
  it("reads the default caption track of the default audio track", () => {
    const tracklistRenderer = {
      audioTracks: [
        {
          captionTrackIndices: [0, 1],
          defaultCaptionTrackIndex: 1,
          hasDefaultTrack: true,
        },
      ],
      defaultAudioTrackIndex: 0,
    }

    expect(resolveDefaultCaptionTrackIndex(tracklistRenderer, 2)).toBe(1)
  })

  it("picks the audio track named by defaultAudioTrackIndex", () => {
    const tracklistRenderer = {
      audioTracks: [
        { captionTrackIndices: [0, 1], defaultCaptionTrackIndex: 0 },
        { captionTrackIndices: [0, 1], defaultCaptionTrackIndex: 1 },
      ],
      defaultAudioTrackIndex: 1,
    }

    expect(resolveDefaultCaptionTrackIndex(tracklistRenderer, 2)).toBe(1)
  })

  it("resolves through captionTrackIndices when the index is numbered against that list", () => {
    const tracklistRenderer = {
      audioTracks: [{ captionTrackIndices: [3, 4], defaultCaptionTrackIndex: 1 }],
      defaultAudioTrackIndex: 0,
    }

    expect(resolveDefaultCaptionTrackIndex(tracklistRenderer, 5)).toBe(4)
  })

  it("returns null when the field is absent, so callers fall through", () => {
    expect(resolveDefaultCaptionTrackIndex({ audioTracks: [{}] }, 2)).toBeNull()
    expect(resolveDefaultCaptionTrackIndex({ audioTracks: [] }, 2)).toBeNull()
    expect(resolveDefaultCaptionTrackIndex(undefined, 2)).toBeNull()
  })

  it("returns null when the index falls outside the track list", () => {
    const tracklistRenderer = {
      audioTracks: [{ defaultCaptionTrackIndex: 5 }],
      defaultAudioTrackIndex: 0,
    }

    expect(resolveDefaultCaptionTrackIndex(tracklistRenderer, 2)).toBeNull()
    expect(resolveDefaultCaptionTrackIndex(tracklistRenderer, 0)).toBeNull()
  })
})
