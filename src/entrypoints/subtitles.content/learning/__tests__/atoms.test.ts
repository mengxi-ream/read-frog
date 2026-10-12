// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStore } from "../../atoms"
import {
  closeWordLookupAtom,
  dragRangeAtom,
  openWordLookupAtom,
  shiftWordLookupAtom,
  wordLookupAtom,
} from "../atoms"

const CUE = {
  text: "I'm running out of patience.",
  translation: "我快没耐心了。",
  start: 0,
  end: 1000,
}
const ANCHOR = { x: 10, y: 20 }
const WORD = { start: 2, end: 2, text: "running", anchor: ANCHOR }
const PHRASE = { start: 2, end: 4, text: "running out", anchor: ANCHOR }

function showCue() {
  subtitlesStore.set(currentTimeMsAtom, 500)
  subtitlesStore.set(currentSubtitleAtom, CUE)
}

describe("word lookup atoms", () => {
  afterEach(() => {
    subtitlesStore.set(closeWordLookupAtom)
    subtitlesStore.set(dragRangeAtom, null)
    subtitlesStore.set(currentSubtitleAtom, null)
  })

  it("runs the click action on one word with the cue as context", () => {
    showCue()

    subtitlesStore.set(openWordLookupAtom, WORD)

    expect(subtitlesStore.get(wordLookupAtom)).toEqual({
      cueStart: 0,
      start: 2,
      end: 2,
      anchor: ANCHOR,
    })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "running",
      contextText: "I'm running out of patience.\n\n我快没耐心了。",
      surface: "video_subtitles",
      rerunNonce: 0,
    })
  })

  it("runs the drag action on several words", () => {
    showCue()

    subtitlesStore.set(openWordLookupAtom, PHRASE)

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 2, end: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-sentence-analysis",
      selectionText: "running out",
    })
  })

  it("ends the drag highlight once the lookup opens", () => {
    subtitlesStore.set(dragRangeAtom, { cueStart: 0, start: 2, end: 4 })

    subtitlesStore.set(openWordLookupAtom, PHRASE)

    expect(subtitlesStore.get(dragRangeAtom)).toBeNull()
  })

  it("gives every open a fresh session key so the card remounts", () => {
    subtitlesStore.set(openWordLookupAtom, WORD)
    const first = subtitlesStore.get(customActionRequestAtom)?.sessionKey

    subtitlesStore.set(openWordLookupAtom, { ...WORD, start: 4, end: 4, text: "out" })

    expect(subtitlesStore.get(customActionRequestAtom)?.sessionKey).not.toBe(first)
  })

  it("falls back to the selected text as context when no cue is on screen", () => {
    subtitlesStore.set(openWordLookupAtom, WORD)

    expect(subtitlesStore.get(customActionRequestAtom)?.contextText).toBe("running")
    expect(subtitlesStore.get(wordLookupAtom)?.cueStart).toBe(-1)
  })

  it("steps a one-word lookup to the next word", () => {
    showCue()
    subtitlesStore.set(openWordLookupAtom, WORD)

    subtitlesStore.set(shiftWordLookupAtom, 1)

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 4, end: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)?.selectionText).toBe("out")
  })

  it("leaves a several-word lookup where it is on an arrow key", () => {
    showCue()
    subtitlesStore.set(openWordLookupAtom, PHRASE)
    const request = subtitlesStore.get(customActionRequestAtom)

    subtitlesStore.set(shiftWordLookupAtom, 1)

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 2, end: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)).toBe(request)
  })

  it("clears both the lookup and the request on close", () => {
    subtitlesStore.set(openWordLookupAtom, WORD)

    subtitlesStore.set(closeWordLookupAtom)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })
})
