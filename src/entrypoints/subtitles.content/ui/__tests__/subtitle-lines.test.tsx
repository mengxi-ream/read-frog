import type { LangCodeISO6393 } from "@read-frog/definitions"
import { render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

import { SubtitlesPair } from "../subtitle-lines"

const mockedAtoms = vi.hoisted(() => ({
  languageAtom: null as any,
  videoSubtitlesAtom: null as any,
}))

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const languageAtom = atom(DEFAULT_CONFIG.language)
  const videoSubtitlesAtom = atom(DEFAULT_CONFIG.videoSubtitles)

  mockedAtoms.languageAtom = languageAtom
  mockedAtoms.videoSubtitlesAtom = videoSubtitlesAtom

  return {
    configFieldsAtomMap: {
      language: languageAtom,
      videoSubtitles: videoSubtitlesAtom,
    },
  }
})

function createStoreWithLanguage(targetCode: LangCodeISO6393) {
  const store = createStore()
  store.set(mockedAtoms.languageAtom, {
    ...DEFAULT_CONFIG.language,
    targetCode,
  })
  store.set(mockedAtoms.videoSubtitlesAtom, DEFAULT_CONFIG.videoSubtitles)
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
