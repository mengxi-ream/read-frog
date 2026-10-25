import { afterEach, describe, expect, it } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStore } from "../../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "../atoms"

const CUE = {
  text: "I'm running out of patience.",
  translation: "我快没耐心了。",
  start: 0,
  end: 1000,
}

function showCue() {
  subtitlesStore.set(currentTimeMsAtom, 500)
  subtitlesStore.set(currentSubtitleAtom, CUE)
}

function indexOf(word: string) {
  return subtitlesStore.get(subtitleTokensAtom).findIndex((token) => token.text === word)
}

describe("word lookup atoms", () => {
  afterEach(() => {
    subtitlesStore.set(lookUpAtom, null)
    subtitlesStore.set(currentSubtitleAtom, null)
  })

  it("cuts the cue on screen into words", () => {
    showCue()

    const words = subtitlesStore
      .get(subtitleTokensAtom)
      .filter((token) => token.isWord)
      .map((token) => token.text)

    expect(words).toEqual(["I'm", "running", "out", "of", "patience"])
  })

  it("looks up one word and hands the dictionary the word with the cue as context", () => {
    showCue()
    const index = indexOf("patience")

    subtitlesStore.set(lookUpAtom, { start: index, end: index })

    expect(subtitlesStore.get(wordLookupAtom)).toEqual({ cueStart: 0, start: index, end: index })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "patience",
      contextText: "I'm running out of patience.\n\n我快没耐心了。",
      surface: "video_subtitles",
      rerunNonce: 0,
    })
  })

  it("joins a range of words, with the text between them, into one selection", () => {
    showCue()

    subtitlesStore.set(lookUpAtom, { start: indexOf("running"), end: indexOf("of") })

    expect(subtitlesStore.get(customActionRequestAtom)?.selectionText).toBe("running out of")
  })

  it("gives every lookup a fresh session key so the card remounts", () => {
    showCue()
    subtitlesStore.set(lookUpAtom, { start: indexOf("out"), end: indexOf("out") })
    const first = subtitlesStore.get(customActionRequestAtom)?.sessionKey

    subtitlesStore.set(lookUpAtom, { start: indexOf("of"), end: indexOf("of") })

    expect(subtitlesStore.get(customActionRequestAtom)?.sessionKey).not.toBe(first)
  })

  it("falls back to the selection itself as context when no cue is on screen", () => {
    subtitlesStore.set(lookUpAtom, { start: 0, end: 0 })

    expect(subtitlesStore.get(wordLookupAtom)?.cueStart).toBe(-1)
    expect(subtitlesStore.get(customActionRequestAtom)?.contextText).toBe("")
  })

  it("clears both the lookup and the request when looking up nothing", () => {
    showCue()
    subtitlesStore.set(lookUpAtom, { start: 0, end: 0 })

    subtitlesStore.set(lookUpAtom, null)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })
})
