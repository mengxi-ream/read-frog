// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { currentSubtitleAtom, currentTimeMsAtom, subtitlesStore } from "../../atoms"
import { closeWordLookupAtom, wordLookupAtom } from "../atoms"
import { useLookupShortcuts } from "../use-lookup-shortcuts"

function renderShortcuts() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={subtitlesStore}>{children}</Provider>
  )
  return renderHook(() => useLookupShortcuts(), { wrapper })
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, composed: true, ...init }),
    )
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

  it("leaves the arrow keys to an input inside a page web component", () => {
    renderShortcuts()
    const host = document.createElement("div")
    const input = document.createElement("input")
    host.attachShadow({ mode: "open" }).append(input)
    document.body.append(host)
    const lookup = subtitlesStore.get(wordLookupAtom)

    press(input, "ArrowLeft")

    expect(subtitlesStore.get(wordLookupAtom)).toBe(lookup)
    expect(pageKeyDown).toHaveBeenCalledTimes(1)
  })

  it("leaves modified arrow keys to the browser and the page", () => {
    renderShortcuts()
    const lookup = subtitlesStore.get(wordLookupAtom)

    press(document.body, "ArrowLeft", { altKey: true })
    press(document.body, "ArrowRight", { metaKey: true })

    expect(subtitlesStore.get(wordLookupAtom)).toBe(lookup)
    expect(pageKeyDown).toHaveBeenCalledTimes(2)
  })

  it("swallows a held arrow key without stepping again", () => {
    subtitlesStore.set(currentTimeMsAtom, 500)
    subtitlesStore.set(currentSubtitleAtom, { text: "one two three", start: 0, end: 1000 })
    renderShortcuts()
    const lookup = subtitlesStore.get(wordLookupAtom)

    press(document.body, "ArrowRight", { repeat: true })

    expect(subtitlesStore.get(wordLookupAtom)).toBe(lookup)
    expect(pageKeyDown).not.toHaveBeenCalled()
    subtitlesStore.set(currentSubtitleAtom, null)
  })

  it("also keeps the keys from page listeners added later on window", () => {
    renderShortcuts()
    const windowKeyDown = vi.fn<(event: KeyboardEvent) => void>()
    window.addEventListener("keydown", windowKeyDown, true)

    press(document.body, "ArrowRight")
    press(document.body, "Escape")

    window.removeEventListener("keydown", windowKeyDown, true)
    expect(windowKeyDown).not.toHaveBeenCalled()
  })

  it("keeps the arrow keys away from the page while the card is open", () => {
    renderShortcuts()

    press(document.body, "ArrowLeft")
    press(document.body, "ArrowRight")

    expect(pageKeyDown).not.toHaveBeenCalled()
  })
})
