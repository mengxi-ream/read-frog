// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it } from "vitest"
import { vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { currentTimeMsAtom, sourceTrackAtom, subtitlesStore } from "../../atoms"
import { closeWordLookupAtom, wordLookupAtom, wordSelectionAtom } from "../atoms"
import { SubtitleWordTokens } from "../subtitle-word-tokens"

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  return {
    configFieldsAtomMap: { selectionToolbar: atom(DEFAULT_CONFIG.selectionToolbar) },
    configAtom: atom(DEFAULT_CONFIG),
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

describe("SubtitleWordTokens", () => {
  afterEach(() => {
    subtitlesStore.set(closeWordLookupAtom)
    subtitlesStore.set(wordSelectionAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
  })

  it("keeps a drag as a selection when the pointer is released outside the subtitles", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[0]!, { button: 0 })
    fireEvent.pointerEnter(words[1]!)
    fireEvent.pointerEnter(words[3]!)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 900, clientY: 40 }))
    })

    expect(subtitlesStore.get(wordSelectionAtom)).toMatchObject({ start: 0, end: 6 })
    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
  })

  it("opens a lookup for a press released on the same word", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[2]!, { button: 0 })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ tokenIndex: 4 })
    expect(subtitlesStore.get(wordSelectionAtom)).toBeNull()
  })

  it("treats a drag that returns to its first word as a click on that word", () => {
    const words = renderLine("You can see the blood run from their face.")

    fireEvent.pointerDown(words[1]!, { button: 0 })
    fireEvent.pointerEnter(words[2]!)
    fireEvent.pointerEnter(words[1]!)
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"))
    })

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ tokenIndex: 2 })
  })
})
