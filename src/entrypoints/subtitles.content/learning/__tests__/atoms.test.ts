// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import {
  EXTERNAL_SELECTION_CLEAR_EVENT,
  EXTERNAL_SELECTION_OPEN_EVENT,
} from "@/utils/constants/selection"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStore } from "../../atoms"
import {
  clearWordSelectionAtom,
  closeWordLookupAtom,
  openWordLookupAtom,
  selectWordsAtom,
  wordLookupAtom,
  wordSelectionAtom,
} from "../atoms"

const CUE = {
  text: "I'm running out of patience.",
  translation: "我快没耐心了。",
  start: 0,
  end: 1000,
}
const LOOKUP = { tokenIndex: 2, term: "patience", anchor: { x: 10, y: 20 } }

function showCue() {
  subtitlesStore.set(currentTimeMsAtom, 500)
  subtitlesStore.set(currentSubtitleAtom, CUE)
}

describe("word lookup atoms", () => {
  afterEach(() => {
    subtitlesStore.set(closeWordLookupAtom)
    subtitlesStore.set(wordSelectionAtom, null)
    subtitlesStore.set(currentSubtitleAtom, null)
  })

  it("opens the lookup and hands the action the word with the cue as context", () => {
    showCue()

    subtitlesStore.set(openWordLookupAtom, LOOKUP)

    expect(subtitlesStore.get(wordLookupAtom)).toEqual({
      cueStart: 0,
      tokenIndex: 2,
      anchor: LOOKUP.anchor,
    })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "patience",
      contextText: "I'm running out of patience.\n\n我快没耐心了。",
      surface: "video_subtitles",
      rerunNonce: 0,
    })
  })

  it("gives every open a fresh session key so the card remounts", () => {
    subtitlesStore.set(openWordLookupAtom, LOOKUP)
    const first = subtitlesStore.get(customActionRequestAtom)?.sessionKey

    subtitlesStore.set(openWordLookupAtom, { ...LOOKUP, tokenIndex: 3, term: "out" })

    expect(subtitlesStore.get(customActionRequestAtom)?.sessionKey).not.toBe(first)
  })

  it("falls back to the word itself as context when no cue is on screen", () => {
    subtitlesStore.set(openWordLookupAtom, LOOKUP)

    expect(subtitlesStore.get(customActionRequestAtom)?.contextText).toBe("patience")
    expect(subtitlesStore.get(wordLookupAtom)?.cueStart).toBe(-1)
  })

  it("clears both the lookup and the request on close", () => {
    subtitlesStore.set(openWordLookupAtom, LOOKUP)

    subtitlesStore.set(closeWordLookupAtom)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })

  it("keeps a drag lit and hands it to the selection toolbar with the cue as context", () => {
    showCue()
    const openListener = vi.fn<(event: Event) => void>()
    window.addEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)

    subtitlesStore.set(selectWordsAtom, {
      start: 2,
      end: 4,
      text: "running out",
      rect: { top: 1, left: 2, width: 3, height: 4 },
      anchor: { x: 5, y: 6 },
      direction: "bottom-right",
    })

    expect(subtitlesStore.get(wordSelectionAtom)).toEqual({ cueStart: 0, start: 2, end: 4 })
    expect((openListener.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      text: "running out",
      contextParagraphs: [CUE.text, CUE.translation],
      rect: { top: 1, left: 2, width: 3, height: 4 },
      anchor: { x: 5, y: 6 },
      direction: "bottom-right",
    })
    window.removeEventListener(EXTERNAL_SELECTION_OPEN_EVENT, openListener)
  })

  it("clears the drag and the selection toolbar together", () => {
    const clearListener = vi.fn<(event: Event) => void>()
    window.addEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, clearListener)
    subtitlesStore.set(wordSelectionAtom, { cueStart: 0, start: 2, end: 4 })

    subtitlesStore.set(clearWordSelectionAtom)

    expect(subtitlesStore.get(wordSelectionAtom)).toBeNull()
    expect(clearListener).toHaveBeenCalledTimes(1)
    window.removeEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, clearListener)
  })
})
