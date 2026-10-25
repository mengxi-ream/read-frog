// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { currentTimeMsAtom, sourceTrackAtom, subtitlesStore } from "../../atoms"
import { lookUpAtom, wordLookupAtom } from "../atoms"
import { SubtitleWordTokens } from "../subtitle-word-tokens"

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const constants = await import("@/utils/constants/config")
  return { configAtom: atom(constants.DEFAULT_CONFIG) }
})

const LINE = "You can see the blood run."

function renderLine(text = LINE) {
  subtitlesStore.set(sourceTrackAtom, [{ text, start: 0, end: 5000 }])
  subtitlesStore.set(currentTimeMsAtom, 1000)
  const { container } = render(
    <Provider store={subtitlesStore}>
      <p data-testid="outside">Video title</p>
      <SubtitleWordTokens />
    </Provider>,
  )
  return [...container.querySelectorAll<HTMLElement>('[data-slot="subtitle-word"]')]
}

/** Selects from `startOffset` in one word's text to `endOffset` in another's, like a mouse drag. */
function select(from: Node, startOffset: number, to: Node, endOffset: number) {
  const range = document.createRange()
  range.setStart(from.firstChild ?? from, startOffset)
  range.setEnd(to.firstChild ?? to, endOffset)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Presses on `pressed`, selects, and lets go over `released`. */
function drag(pressed: HTMLElement, released: Element, makeSelection: () => void) {
  fireEvent.mouseDown(pressed)
  makeSelection()
  act(() => {
    released.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }))
  })
}

function disableBuiltInAction(key: "dictionary" | "sentenceAnalysis") {
  const config = subtitlesStore.get(configAtom)
  const { builtInActions } = config.selectionToolbar
  subtitlesStore.set(configAtom, {
    ...config,
    selectionToolbar: {
      ...config.selectionToolbar,
      builtInActions: { ...builtInActions, [key]: { ...builtInActions[key], enabled: false } },
    },
  })
}

function pickActions(wordLookup: { clickActionId: string; dragActionId: string }) {
  subtitlesStore.set(configAtom, { ...subtitlesStore.get(configAtom), wordLookup })
}

describe("SubtitleWordTokens", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    subtitlesStore.set(lookUpAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
    subtitlesStore.set(configAtom, DEFAULT_CONFIG)
  })

  it("looks up the clicked word by its place in the line", () => {
    const words = renderLine()

    fireEvent.click(words[2]!)

    expect(words[2]!.dataset.index).toBe("4")
    expect(subtitlesStore.get(wordLookupAtom)).toEqual({ cueStart: 0, start: 4, end: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "see",
    })
  })

  it("highlights only the looked-up word", () => {
    const words = renderLine()

    fireEvent.click(words[1]!)

    expect(words.map((word) => word.classList.contains("bg-amber-300"))).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it("keeps the click from reaching the player", () => {
    const words = renderLine()
    const playerClick = vi.fn<() => void>()
    document.addEventListener("click", playerClick)

    fireEvent.click(words[0]!)

    document.removeEventListener("click", playerClick)
    expect(playerClick).not.toHaveBeenCalled()
  })

  it("runs Sentence Analysis on a drag, snapped out to whole words", () => {
    const words = renderLine()

    // From "c|an" to "th|e".
    drag(words[1]!, words[3]!, () => select(words[1]!, 1, words[3]!, 2))

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 2, end: 6 })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-sentence-analysis",
      selectionText: "can see the",
    })
    expect(window.getSelection()?.rangeCount).toBe(0)
  })

  it("reads the drag even when the button comes up outside the subtitles", () => {
    const words = renderLine()
    const outside = document.querySelector('[data-testid="outside"]')!

    drag(words[0]!, outside, () => select(words[0]!, 0, words[2]!, 3))

    expect(subtitlesStore.get(customActionRequestAtom)?.selectionText).toBe("You can see")
  })

  it("keeps the selection toolbar from opening on a drag it looked up", () => {
    const words = renderLine()
    const toolbarMouseUp = vi.fn<() => void>()
    document.addEventListener("mouseup", toolbarMouseUp)

    drag(words[0]!, words[1]!, () => select(words[0]!, 0, words[1]!, 3))

    document.removeEventListener("mouseup", toolbarMouseUp)
    expect(toolbarMouseUp).not.toHaveBeenCalled()
  })

  it("leaves a selection inside one word alone, as a selection", () => {
    const words = renderLine()

    drag(words[4]!, words[4]!, () => select(words[4]!, 1, words[4]!, 3))
    fireEvent.click(words[4]!)

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(window.getSelection()?.toString()).toBe("lo")
  })

  it("hands a selection that leaves the line to the page", () => {
    const words = renderLine()
    const outside = document.querySelector('[data-testid="outside"]')!
    const toolbarMouseUp = vi.fn<() => void>()
    document.addEventListener("mouseup", toolbarMouseUp)

    drag(words[1]!, outside, () => select(outside, 0, words[1]!, 3))

    document.removeEventListener("mouseup", toolbarMouseUp)
    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(toolbarMouseUp).toHaveBeenCalled()
  })

  it("hands drags to the page while still looking up clicks when Sentence Analysis is off", () => {
    disableBuiltInAction("sentenceAnalysis")
    const words = renderLine()

    drag(words[0]!, words[2]!, () => select(words[0]!, 0, words[2]!, 3))
    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()

    window.getSelection()?.removeAllRanges()
    fireEvent.click(words[2]!)
    expect(subtitlesStore.get(customActionRequestAtom)?.actionId).toBe("default-dictionary")
  })

  it("runs the actions picked in settings", () => {
    pickActions({ clickActionId: "default-sentence-analysis", dragActionId: "default-dictionary" })
    const words = renderLine()

    fireEvent.click(words[2]!)
    expect(subtitlesStore.get(customActionRequestAtom)?.actionId).toBe("default-sentence-analysis")

    drag(words[0]!, words[2]!, () => select(words[0]!, 0, words[2]!, 3))
    expect(subtitlesStore.get(customActionRequestAtom)?.actionId).toBe("default-dictionary")
  })

  it("falls back to Dictionary when the picked click action is gone", () => {
    pickActions({ clickActionId: "deleted-action", dragActionId: "default-sentence-analysis" })
    const words = renderLine()

    fireEvent.click(words[2]!)

    expect(subtitlesStore.get(customActionRequestAtom)?.actionId).toBe("default-dictionary")
  })

  it("shows plain text when both built-in actions are off", () => {
    disableBuiltInAction("dictionary")
    disableBuiltInAction("sentenceAnalysis")

    expect(renderLine()).toHaveLength(0)
  })
})
