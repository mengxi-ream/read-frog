// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import { currentTimeMsAtom, sourceTrackAtom } from "../../atoms"
import { subtitlesHoveredAtom } from "../../learning/atoms"
import { SubtitlesView } from "../subtitles-view"

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  return {
    configFieldsAtomMap: {
      language: atom(DEFAULT_CONFIG.language),
      selectionToolbar: atom(DEFAULT_CONFIG.selectionToolbar),
      videoSubtitles: atom(DEFAULT_CONFIG.videoSubtitles),
    },
  }
})

vi.mock("../use-vertical-drag", () => ({
  useVerticalDrag: () => ({
    refs: { window: { current: null }, container: { current: null }, handle: { current: null } },
    windowStyle: {},
    positionStyle: {},
    isDragging: false,
  }),
}))

describe("SubtitlesView", () => {
  it("shows the cue that started while the view was hidden between cues", () => {
    const store = createStore()
    store.set(sourceTrackAtom, [
      { text: "First line", start: 0, end: 1000 },
      { text: "Second line", start: 2000, end: 3000 },
    ])
    store.set(currentTimeMsAtom, 500)

    const view = (showContent: boolean) => (
      <Provider store={store}>
        <SubtitlesView showContent={showContent} />
      </Provider>
    )
    const { container, rerender } = render(view(true))
    const mainLine = () => container.querySelector(".subtitles-main")?.textContent

    expect(mainLine()).toBe("First line")

    rerender(view(false))
    act(() => store.set(currentTimeMsAtom, 2500))
    rerender(view(true))

    expect(mainLine()).toBe("Second line")
  })

  it("marks the subtitles hovered while the pointer is on the box, and clears it when the box goes away", () => {
    const store = createStore()
    const { container, unmount } = render(
      <Provider store={store}>
        <SubtitlesView showContent />
      </Provider>,
    )
    const box = container.querySelector(`.${SUBTITLES_BOX_CLASS}`)!

    fireEvent.pointerEnter(box)
    expect(store.get(subtitlesHoveredAtom)).toBe(true)
    fireEvent.pointerLeave(box)
    expect(store.get(subtitlesHoveredAtom)).toBe(false)

    fireEvent.pointerEnter(box)
    unmount()
    expect(store.get(subtitlesHoveredAtom)).toBe(false)
  })
})
