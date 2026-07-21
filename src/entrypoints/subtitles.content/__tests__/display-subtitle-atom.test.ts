import { describe, expect, it } from "vitest"
import {
  currentSubtitleAtom,
  currentTimeMsAtom,
  displaySubtitleAtom,
  sourceTrackAtom,
  subtitlesStore,
} from "../atoms"

describe("displaySubtitleAtom", () => {
  it("falls back to source track when no translated cue is scheduled", () => {
    subtitlesStore.set(currentTimeMsAtom, 500)
    subtitlesStore.set(currentSubtitleAtom, null)
    subtitlesStore.set(sourceTrackAtom, [
      { text: "hello", start: 0, end: 1000 },
      { text: "world", start: 1000, end: 2000 },
    ])

    expect(subtitlesStore.get(displaySubtitleAtom)).toEqual({
      text: "hello",
      start: 0,
      end: 1000,
    })
  })

  it("prefers the translated scheduler cue when present", () => {
    subtitlesStore.set(currentTimeMsAtom, 500)
    subtitlesStore.set(sourceTrackAtom, [{ text: "hello", start: 0, end: 1000 }])
    subtitlesStore.set(currentSubtitleAtom, {
      text: "hello",
      start: 0,
      end: 1000,
      translation: "你好",
    })

    expect(subtitlesStore.get(displaySubtitleAtom)?.translation).toBe("你好")
  })
})
