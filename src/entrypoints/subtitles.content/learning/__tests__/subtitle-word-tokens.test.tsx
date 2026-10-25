// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
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
    subtitlesStore.set(lookUpAtom, null)
    subtitlesStore.set(sourceTrackAtom, [])
  })

  it("looks up the clicked word by its place in the line", () => {
    const words = renderLine("You can see the blood run.")

    fireEvent.click(words[2]!)

    expect(words[2]!.dataset.index).toBe("4")
    expect(subtitlesStore.get(wordLookupAtom)).toEqual({ cueStart: 0, start: 4, end: 4 })
    expect(subtitlesStore.get(customActionRequestAtom)?.selectionText).toBe("see")
  })

  it("highlights only the looked-up word", () => {
    const words = renderLine("You can see the blood run.")

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
    const words = renderLine("You can see the blood run.")
    const playerClick = vi.fn<() => void>()
    document.addEventListener("click", playerClick)

    fireEvent.click(words[0]!)

    document.removeEventListener("click", playerClick)
    expect(playerClick).not.toHaveBeenCalled()
  })
})
