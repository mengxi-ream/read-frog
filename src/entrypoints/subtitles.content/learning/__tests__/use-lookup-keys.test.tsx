// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, renderHook } from "@testing-library/react"
import { Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { currentTimeMsAtom, sourceTrackAtom, subtitlesStore } from "../../atoms"
import { lookUpAtom, subtitleTokensAtom, wordLookupAtom } from "../atoms"
import { useLookupKeys } from "../use-lookup-keys"

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={subtitlesStore}>{children}</Provider>
)

function indexOf(word: string) {
  return subtitlesStore.get(subtitleTokensAtom).findIndex((token) => token.text === word)
}

function lookUp(from: string, to = from) {
  act(() => subtitlesStore.set(lookUpAtom, { start: indexOf(from), end: indexOf(to) }))
}

function lookedUpWord() {
  const lookup = subtitlesStore.get(wordLookupAtom)
  return lookup && subtitlesStore.get(subtitleTokensAtom)[lookup.start]?.text
}

function press(key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, composed: true, ...init }),
    )
  })
}

const pageKeys = vi.fn<(key: string) => void>()
const onPageKey = (event: KeyboardEvent) => pageKeys(event.key)

describe("useLookupKeys", () => {
  beforeEach(() => {
    subtitlesStore.set(sourceTrackAtom, [
      { text: "Keep the change, ya filthy animal.", start: 0, end: 5000 },
    ])
    subtitlesStore.set(currentTimeMsAtom, 1000)
    document.addEventListener("keydown", onPageKey)
    renderHook(() => useLookupKeys(), { wrapper })
  })

  afterEach(() => {
    document.removeEventListener("keydown", onPageKey)
    pageKeys.mockClear()
    act(() => subtitlesStore.set(lookUpAtom, null))
    subtitlesStore.set(sourceTrackAtom, [])
    document.body.replaceChildren()
  })

  it("steps a one-word lookup along the line, past the punctuation, without the page seeing it", () => {
    lookUp("change")

    press("ArrowRight")
    expect(lookedUpWord()).toBe("ya")

    press("ArrowLeft")
    press("ArrowLeft")
    expect(lookedUpWord()).toBe("the")
    expect(pageKeys).not.toHaveBeenCalled()
  })

  it("keeps the arrow keys from the page at the end of the line", () => {
    lookUp("animal")

    press("ArrowRight")

    expect(lookedUpWord()).toBe("animal")
    expect(pageKeys).not.toHaveBeenCalled()
  })

  it("leaves the arrow keys to the page while several words are looked up", () => {
    lookUp("Keep", "change")

    press("ArrowRight")

    expect(subtitlesStore.get(wordLookupAtom)).toMatchObject({ start: indexOf("Keep") })
    expect(pageKeys).toHaveBeenCalledWith("ArrowRight")
  })

  it("leaves the arrow keys to a focused control on the page", () => {
    const slider = document.createElement("div")
    slider.setAttribute("role", "slider")
    document.body.append(slider)
    lookUp("change")

    press("ArrowRight", slider)

    expect(lookedUpWord()).toBe("change")
    expect(pageKeys).toHaveBeenCalledWith("ArrowRight")
  })

  it("closes the lookup on Escape without the page seeing it", () => {
    lookUp("change")

    press("Escape")

    expect(subtitlesStore.get(wordLookupAtom)).toBeNull()
    expect(pageKeys).not.toHaveBeenCalled()
  })

  it("steps once for a held key and lets modified arrows through", () => {
    lookUp("change")

    press("ArrowRight", document.body, { repeat: true })
    press("ArrowRight", document.body, { altKey: true })

    expect(lookedUpWord()).toBe("change")
    expect(pageKeys).toHaveBeenCalledTimes(1)
  })

  it("ignores keys typed into Read Frog's own UI", () => {
    const host = document.createElement("div")
    host.classList.add(REACT_SHADOW_HOST_CLASS)
    document.body.append(host)
    lookUp("change")

    press("ArrowRight", host)
    press("Escape", host)

    expect(lookedUpWord()).toBe("change")
  })
})
