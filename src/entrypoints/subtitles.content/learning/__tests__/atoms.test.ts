import { afterEach, describe, expect, it } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStore } from "../../atoms"
import { closeWordLookupAtom, openWordLookupAtom, wordLookupAtom } from "../atoms"

const SESSION = { tokenIndex: 2, term: "patience", anchor: { x: 10, y: 20 } }

describe("word lookup atoms", () => {
  afterEach(() => {
    subtitlesStore.set(closeWordLookupAtom)
    subtitlesStore.set(currentSubtitleAtom, null)
  })

  it("opens the session and hands the dictionary the word with the cue as context", () => {
    subtitlesStore.set(currentTimeMsAtom, 500)
    subtitlesStore.set(currentSubtitleAtom, {
      text: "I'm running out of patience.",
      translation: "我快没耐心了。",
      start: 0,
      end: 1000,
    })

    subtitlesStore.set(openWordLookupAtom, SESSION)

    expect(subtitlesStore.get(wordLookupAtom)).toEqual({ ...SESSION, cueStart: 0 })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "patience",
      contextText: "I'm running out of patience.\n\n我快没耐心了。",
      surface: "video_subtitles",
      rerunNonce: 0,
    })
  })

  it("gives every open a fresh session key so the card remounts", () => {
    subtitlesStore.set(openWordLookupAtom, SESSION)
    const first = subtitlesStore.get(customActionRequestAtom)?.sessionKey

    subtitlesStore.set(openWordLookupAtom, { ...SESSION, tokenIndex: 3, term: "out" })

    expect(subtitlesStore.get(customActionRequestAtom)?.sessionKey).not.toBe(first)
  })

  it("falls back to the word itself as context when no cue is on screen", () => {
    subtitlesStore.set(openWordLookupAtom, SESSION)

    expect(subtitlesStore.get(customActionRequestAtom)?.contextText).toBe("patience")
    expect(subtitlesStore.get(wordLookupAtom)?.cueStart).toBe(-1)
  })

  it("clears both the session and the request on close", () => {
    subtitlesStore.set(openWordLookupAtom, SESSION)

    subtitlesStore.set(closeWordLookupAtom)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })
})
