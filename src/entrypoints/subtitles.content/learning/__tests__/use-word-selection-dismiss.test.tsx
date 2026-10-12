// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EXTERNAL_SELECTION_CLEAR_EVENT } from "@/utils/constants/selection"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStore } from "../../atoms"
import { wordSelectionAtom } from "../atoms"
import { SELECTION_TOOLBAR_HOST_TAG } from "../page-events"
import { useWordSelectionDismiss } from "../use-word-selection-dismiss"

function renderDismiss() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={subtitlesStore}>{children}</Provider>
  )
  return renderHook(() => useWordSelectionDismiss(), { wrapper })
}

function pressEscape(target: EventTarget) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    )
  })
}

describe("useWordSelectionDismiss", () => {
  const pageKeyDown = vi.fn<(event: KeyboardEvent) => void>()
  const toolbarClear = vi.fn<(event: Event) => void>()

  beforeEach(() => {
    document.addEventListener("keydown", pageKeyDown, true)
    window.addEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, toolbarClear)
    subtitlesStore.set(currentTimeMsAtom, 500)
    subtitlesStore.set(currentSubtitleAtom, { text: "one two three", start: 0, end: 1000 })
    subtitlesStore.set(wordSelectionAtom, { cueStart: 0, start: 0, end: 2 })
  })

  afterEach(() => {
    document.removeEventListener("keydown", pageKeyDown, true)
    window.removeEventListener(EXTERNAL_SELECTION_CLEAR_EVENT, toolbarClear)
    pageKeyDown.mockClear()
    toolbarClear.mockClear()
    subtitlesStore.set(wordSelectionAtom, null)
    subtitlesStore.set(currentSubtitleAtom, null)
    document.body.replaceChildren()
  })

  it("clears the drag on Escape without letting the page see the key", () => {
    renderDismiss()

    pressEscape(document.body)

    expect(subtitlesStore.get(wordSelectionAtom)).toBeNull()
    expect(toolbarClear).toHaveBeenCalledTimes(1)
    expect(pageKeyDown).not.toHaveBeenCalled()
  })

  it("lets Escape from the selection toolbar reach its own popovers", () => {
    const toolbar = document.createElement(SELECTION_TOOLBAR_HOST_TAG)
    const button = document.createElement("button")
    toolbar.attachShadow({ mode: "open" }).append(button)
    document.body.append(toolbar)
    renderDismiss()

    pressEscape(button)

    expect(subtitlesStore.get(wordSelectionAtom)).toBeNull()
    expect(pageKeyDown).toHaveBeenCalledTimes(1)
  })
})
