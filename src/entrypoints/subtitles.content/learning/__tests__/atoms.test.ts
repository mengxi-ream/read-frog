import { afterEach, describe, expect, it } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { currentTimeMsAtom, sourceTrackAtom, subtitlesStore } from "../../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "../atoms"

function showCue(text: string, translation?: string) {
  subtitlesStore.set(sourceTrackAtom, [{ text, translation, start: 0, end: 5000 }])
  subtitlesStore.set(currentTimeMsAtom, 1000)
}

function indexOf(word: string) {
  return subtitlesStore.get(subtitleTokensAtom).findIndex((token) => token.text === word)
}

describe("word lookup atoms", () => {
  afterEach(() => {
    subtitlesStore.set(lookUpAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
  })

  it("looks up a word with Dictionary, using the cue and its translation as context", () => {
    showCue("I'm running out of patience.", "我快没耐心了。")

    subtitlesStore.set(lookUpAtom, indexOf("patience"))

    expect(subtitlesStore.get(wordLookupAtom)).toEqual({ cueStart: 0, index: indexOf("patience") })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "patience",
      cleanSelection: "patience",
      contextText: "I'm running out of patience.\n\n我快没耐心了。",
      surface: "video_subtitles",
      rerunNonce: 0,
    })
  })

  it("closes the lookup on null, and on a place that holds no word", () => {
    showCue("I'm running out of patience.")
    subtitlesStore.set(lookUpAtom, indexOf("out"))

    subtitlesStore.set(lookUpAtom, indexOf(" "))
    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()

    subtitlesStore.set(lookUpAtom, indexOf("out"))
    subtitlesStore.set(lookUpAtom, null)
    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })
})
