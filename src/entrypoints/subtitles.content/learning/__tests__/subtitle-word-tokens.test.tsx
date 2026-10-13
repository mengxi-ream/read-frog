// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { vi } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { currentTimeMsAtom, sourceTrackAtom, subtitlesStore } from "../../atoms"
import { closeWordLookupAtom, dragRangeAtom, wordLookupAtom } from "../atoms"
import { SubtitleWordTokens } from "../subtitle-word-tokens"

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const constants = await import("@/utils/constants/config")
  return {
    configFieldsAtomMap: { selectionToolbar: atom(constants.DEFAULT_CONFIG.selectionToolbar) },
    configAtom: atom(constants.DEFAULT_CONFIG),
  }
})

function renderLine(text: string) {
  subtitlesStore.set(sourceTrackAtom, [{ text, start: 0, end: 5000 }])
  subtitlesStore.set(currentTimeMsAtom, 1000)
  const { container } = render(
    <Provider store={subtitlesStore}>
      <SubtitleWordTokens />
    </Provider>,
  )
  return [...container.querySelectorAll<HTMLElement>('[data-slot="subtitle-word"]')]
}

const releasePointerCapture = vi.fn<(pointerId: number) => void>()

describe("SubtitleWordTokens", () => {
  beforeAll(() => {
    HTMLElement.prototype.hasPointerCapture = () => true
    HTMLElement.prototype.releasePointerCapture = releasePointerCapture
  })

  afterEach(() => {
    releasePointerCapture.mockClear()
    subtitlesStore.set(closeWordLookupAtom)
    subtitlesStore.set(dragRangeAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
    subtitlesStore.set(configAtom, DEFAULT_CONFIG)
  })

  it("lights the words under a drag before it is released", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    fireEvent.pointerEnter(words[3]!)

    expect(subtitlesStore.get(dragRangeAtom)).toMatchObject({ start: 0, end: 6 })
    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
  })

  it("runs the drag action on the dragged words, even when released outside the subtitles", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    fireEvent.pointerEnter(words[3]!)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 900, clientY: 40 }))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 0, end: 6 })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-sentence-analysis",
      selectionText: "You can see the",
    })
    expect(subtitlesStore.get(dragRangeAtom)).toBeNull()
  })

  it("releases the touch pointer capture so a drag reaches the next words", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0, pointerId: 7 })

    expect(releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it("drops the drag when the browser cancels the pointer", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointercancel"))
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(dragRangeAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })

  it("drops the drag when the cue changes before the release", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    act(() => {
      subtitlesStore.set(sourceTrackAtom, [{ text: "A different line now.", start: 0, end: 5000 }])
    })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(dragRangeAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })

  it("drops the drag when the next cue repeats the same text", () => {
    const line = "You can see the blood run from their face."
    const words = renderLine(line)
    act(() => {
      subtitlesStore.set(sourceTrackAtom, [
        { text: line, start: 0, end: 2000 },
        { text: line, start: 2000, end: 4000 },
      ])
    })

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    act(() => {
      subtitlesStore.set(currentTimeMsAtom, 3000)
    })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(dragRangeAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })

  it("ignores other pointers while a drag is held", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0, pointerId: 1 })
    fireEvent.pointerEnter(words[1]!, { pointerId: 1 })
    fireEvent.pointerDown(words[3]!, { button: 0, pointerId: 2 })
    fireEvent.pointerEnter(words[4]!, { pointerId: 2 })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2 }))
    })

    expect(subtitlesStore.get(dragRangeAtom)).toMatchObject({ start: 0, end: 2 })
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }))
    })

    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({ selectionText: "You can" })
  })

  it("runs the click action for a press released on the same word", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[2]!, { button: 0 })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 4, end: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-dictionary",
      selectionText: "see",
    })
  })

  it("keeps drag lookups working when the click action is disabled", () => {
    const { builtInActions } = DEFAULT_CONFIG.selectionToolbar
    subtitlesStore.set(configAtom, {
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        builtInActions: {
          ...builtInActions,
          dictionary: { ...builtInActions.dictionary, enabled: false },
        },
      },
    })
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[2]!, { button: 0 })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(customActionRequestAtom)).toMatchObject({
      actionId: "default-sentence-analysis",
      selectionText: "You can",
    })

    fireEvent.pointerDown(words[3]!, { button: 0 })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(subtitlesStore.get(customActionRequestAtom)).toBeNull()
  })

  it("treats a drag that returns to its first word as a click on that word", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[1]!, { button: 0 })
    fireEvent.pointerEnter(words[2]!)
    fireEvent.pointerEnter(words[1]!)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: 2, end: 2 })
    expect(subtitlesStore.get(customActionRequestAtom)?.actionId).toBe("default-dictionary")
  })
})
