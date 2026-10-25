// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { currentTimeMsAtom, sourceTrackAtom, subtitlesStore } from "../../atoms"
import { lookUpAtom, wordLookupAtom } from "../atoms"
import { SubtitleWordTokens } from "../subtitle-word-tokens"

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const constants = await import("@/utils/constants/config")
  return {
    configFieldsAtomMap: { selectionToolbar: atom(constants.DEFAULT_CONFIG.selectionToolbar) },
  }
})

function renderLine(text = "You can see the blood run.") {
  subtitlesStore.set(sourceTrackAtom, [{ text, start: 0, end: 5000 }])
  subtitlesStore.set(currentTimeMsAtom, 1000)
  const { container } = render(
    <Provider store={subtitlesStore}>
      <SubtitleWordTokens />
    </Provider>,
  )
  return [...container.querySelectorAll<HTMLElement>('[data-slot="subtitle-word"]')]
}

describe("SubtitleWordTokens", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    subtitlesStore.set(lookUpAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
    void subtitlesStore.set(configFieldsAtomMap.selectionToolbar, DEFAULT_CONFIG.selectionToolbar)
  })

  it("looks up the clicked word and highlights only that word", () => {
    const words = renderLine()

    fireEvent.click(words[2]!)

    expect(subtitlesStore.get(wordLookupAtom)).toEqual({ cueStart: 0, index: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)?.selectionText).toBe("see")
    expect(words.filter((word) => word.classList.contains("bg-amber-300"))).toEqual([words[2]])
  })

  it("leaves a click that ends a text selection to the selection toolbar", () => {
    const words = renderLine()
    const range = document.createRange()
    range.setStart(words[4]!.firstChild!, 1)
    range.setEnd(words[4]!.firstChild!, 3)
    window.getSelection()!.addRange(range)

    fireEvent.click(words[4]!)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
  })

  it("clears a text selection on the line when the next cue comes on", () => {
    const words = renderLine()
    const range = document.createRange()
    range.setStart(words[1]!.firstChild!, 1)
    range.setEnd(words[3]!.firstChild!, 2)
    window.getSelection()!.addRange(range)

    act(() => {
      subtitlesStore.set(sourceTrackAtom, [
        { text: "You can see the blood run.", start: 0, end: 2000 },
        { text: "We may go to the park now.", start: 2000, end: 5000 },
      ])
      subtitlesStore.set(currentTimeMsAtom, 3000)
    })

    // Cleared, not just collapsed: clearing is what fires the selectionchange the toolbar closes on.
    expect(window.getSelection()!.rangeCount).toBe(0)
  })

  it("shows plain text when the built-in Dictionary is off", () => {
    const { selectionToolbar } = DEFAULT_CONFIG
    void subtitlesStore.set(configFieldsAtomMap.selectionToolbar, {
      ...selectionToolbar,
      builtInActions: {
        ...selectionToolbar.builtInActions,
        dictionary: { ...selectionToolbar.builtInActions.dictionary, enabled: false },
      },
    })

    expect(renderLine()).toHaveLength(0)
  })
})
