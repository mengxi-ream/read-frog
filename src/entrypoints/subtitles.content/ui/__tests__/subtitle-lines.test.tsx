// @vitest-environment jsdom
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { render } from "@testing-library/react"
import { atom, createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

import { SubtitlesPair } from "../subtitle-lines"

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as any

const languageAtom = atom(DEFAULT_CONFIG.language)
const videoSubtitlesAtom = atom(DEFAULT_CONFIG.videoSubtitles)

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    language: languageAtom,
    videoSubtitles: videoSubtitlesAtom,
  },
}))

function createStoreWithLanguage(targetCode: LangCodeISO6393) {
  const store = createStore()
  store.set(languageAtom, {
    ...DEFAULT_CONFIG.language,
    targetCode,
  })
  store.set(videoSubtitlesAtom, DEFAULT_CONFIG.videoSubtitles)
  return store
}

describe("subtitle lines", () => {
  it("applies rtl direction to translation subtitle for Arabic target language", () => {
    const store = createStoreWithLanguage("arb")

    const { container } = render(
      <Provider store={store}>
        <SubtitlesPair
          mainText=""
          mainStyle={DEFAULT_CONFIG.videoSubtitles.style.main}
          translationText="مرحبًا"
          translationStyle={DEFAULT_CONFIG.videoSubtitles.style.translation}
          showMain={false}
          showTranslation={true}
          translationAbove={false}
        />
      </Provider>,
    )

    const text = container.querySelector("text")
    expect(text).toBeTruthy()
    expect(text!.getAttribute("direction")).toBe("rtl")
    expect(text!.getAttribute("lang")).toBe("ar")
  })

  it("applies ltr direction to translation subtitle for English target language", () => {
    const store = createStoreWithLanguage("eng")

    const { container } = render(
      <Provider store={store}>
        <SubtitlesPair
          mainText=""
          mainStyle={DEFAULT_CONFIG.videoSubtitles.style.main}
          translationText="Hello world"
          translationStyle={DEFAULT_CONFIG.videoSubtitles.style.translation}
          showMain={false}
          showTranslation={true}
          translationAbove={false}
        />
      </Provider>,
    )

    const text = container.querySelector("text")
    expect(text).toBeTruthy()
    expect(text!.getAttribute("direction")).toBe("ltr")
    expect(text!.getAttribute("lang")).toBe("en")
  })

  it("renders main subtitle without dir/lang attributes", () => {
    const store = createStoreWithLanguage("eng")

    const { container } = render(
      <Provider store={store}>
        <SubtitlesPair
          mainText="Hello world"
          mainStyle={DEFAULT_CONFIG.videoSubtitles.style.main}
          translationText=""
          translationStyle={DEFAULT_CONFIG.videoSubtitles.style.translation}
          showMain={true}
          showTranslation={false}
          translationAbove={false}
        />
      </Provider>,
    )

    const text = container.querySelector("text")
    expect(text).toBeTruthy()
    expect(text!.getAttribute("direction")).toBeNull()
    expect(text!.getAttribute("lang")).toBeNull()
  })
})
