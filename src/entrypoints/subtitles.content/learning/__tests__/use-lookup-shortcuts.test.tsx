// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { subtitlesStore } from "../../atoms"
import { closeWordLookupAtom, wordLookupAtom } from "../atoms"
import { useLookupShortcuts } from "../use-lookup-shortcuts"

function renderShortcuts() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={subtitlesStore}>{children}</Provider>
  )
  return renderHook(() => useLookupShortcuts(), { wrapper })
}

function press(target: EventTarget, key: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true }))
  })
}

function createExtensionButton() {
  const host = document.createElement("div")
  host.classList.add(REACT_SHADOW_HOST_CLASS)
  const button = document.createElement("button")
  host.attachShadow({ mode: "open" }).append(button)
  document.body.append(host)
  return button
}

describe("useLookupShortcuts", () => {
  const pageKeyDown = vi.fn<(event: KeyboardEvent) => void>()

  beforeEach(() => {
    document.addEventListener("keydown", pageKeyDown, true)
    subtitlesStore.set(wordLookupAtom, { cueStart: 0, start: 0, end: 0, anchor: { x: 0, y: 0 } })
  })

  afterEach(() => {
    document.removeEventListener("keydown", pageKeyDown, true)
    pageKeyDown.mockClear()
    subtitlesStore.set(closeWordLookupAtom)
    document.body.replaceChildren()
  })

  it("closes the card on Escape without letting the page see the key", () => {
    renderShortcuts()

    press(document.body, "Escape")

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(pageKeyDown).not.toHaveBeenCalled()
  })

  it("leaves Escape inside the extension UI to the card and its menus", () => {
    renderShortcuts()

    press(createExtensionButton(), "Escape")

    expect(subtitlesStore.get(wordLookupAtom)).not.toBeNull()
    expect(pageKeyDown).toHaveBeenCalledTimes(1)
  })

  it("leaves the arrow keys inside the extension UI to its own controls", () => {
    renderShortcuts()
    const lookup = subtitlesStore.get(wordLookupAtom)

    press(createExtensionButton(), "ArrowRight")

    expect(subtitlesStore.get(wordLookupAtom)).toBe(lookup)
    expect(pageKeyDown).toHaveBeenCalledTimes(1)
  })

  it("keeps the arrow keys away from the page while the card is open", () => {
    renderShortcuts()

    press(document.body, "ArrowLeft")
    press(document.body, "ArrowRight")

    expect(pageKeyDown).not.toHaveBeenCalled()
  })
})
