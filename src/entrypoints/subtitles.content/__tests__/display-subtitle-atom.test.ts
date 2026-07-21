import { afterEach, describe, expect, it } from "vitest"
import {
  adPlayingAtom,
  currentSubtitleAtom,
  currentTimeMsAtom,
  displaySubtitleAtom,
  sourceTrackAtom,
  subtitlesShowContentAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
} from "../atoms"

describe("displaySubtitleAtom", () => {
  afterEach(() => {
    subtitlesStore.set(adPlayingAtom, false)
    subtitlesStore.set(currentSubtitleAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
    subtitlesStore.set(subtitlesVisibleAtom, false)
  })

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

  it("ignores a stale scheduled cue that no longer covers the current time", () => {
    subtitlesStore.set(currentTimeMsAtom, 2500)
    subtitlesStore.set(sourceTrackAtom, [
      { text: "hello", start: 0, end: 1000 },
      { text: "later", start: 2000, end: 3000 },
    ])
    // Scheduler atom lagging behind the clock.
    subtitlesStore.set(currentSubtitleAtom, {
      text: "hello",
      start: 0,
      end: 1000,
      translation: "你好",
    })

    expect(subtitlesStore.get(displaySubtitleAtom)).toEqual({
      text: "later",
      start: 2000,
      end: 3000,
    })
  })

  it("hides main-video captions while an ad is playing", () => {
    subtitlesStore.set(currentTimeMsAtom, 500)
    subtitlesStore.set(subtitlesVisibleAtom, true)
    subtitlesStore.set(sourceTrackAtom, [{ text: "hello", start: 0, end: 1000 }])
    subtitlesStore.set(currentSubtitleAtom, {
      text: "hello",
      start: 0,
      end: 1000,
      translation: "你好",
    })
    subtitlesStore.set(adPlayingAtom, true)

    expect(subtitlesStore.get(displaySubtitleAtom)).toBeNull()
    expect(subtitlesStore.get(subtitlesShowContentAtom)).toBe(false)
    // User toggle intent stays on.
    expect(subtitlesStore.get(subtitlesVisibleAtom)).toBe(true)
  })
})
