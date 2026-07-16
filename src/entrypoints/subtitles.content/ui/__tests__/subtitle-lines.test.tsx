// @vitest-environment jsdom
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { act, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { TRANSLATION_PENDING_INDICATOR_DELAY_MS } from "@/utils/constants/subtitles"
import { currentSubtitleAtom } from "../../atoms"
import { MainSubtitle, TranslationSubtitle } from "../subtitle-lines"

const mockedAtoms = vi.hoisted(() => ({
  languageAtom: null as any,
  videoSubtitlesAtom: null as any,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => (key === "subtitles.state.translating" ? "Translating…" : key),
  },
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
  afterEach(() => {
    vi.useRealTimers()
  })

  it("applies rtl attributes to translation subtitle for Arabic target language", () => {
    const store = createStoreWithLanguage("arb")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="مرحبًا" />
      </Provider>,
    )

    const line = screen.getByText("مرحبًا")
    expect(line).toHaveAttribute("dir", "rtl")
    expect(line).toHaveAttribute("lang", "ar")
  })

  it("applies ltr attributes to translation subtitle for English target language", () => {
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="Hello world" />
      </Provider>,
    )

    const line = screen.getByText("Hello world")
    expect(line).toHaveAttribute("dir", "ltr")
    expect(line).toHaveAttribute("lang", "en")
  })

  it("keeps main subtitle line without forced dir/lang attributes", () => {
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <MainSubtitle content="Hello world" />
      </Provider>,
    )

    const line = screen.getByText("Hello world")
    expect(line).not.toHaveAttribute("dir")
    expect(line).not.toHaveAttribute("lang")
  })

  it("delays pending translating label so fast translations do not flash", () => {
    vi.useFakeTimers()
    const store = createStoreWithLanguage("eng")
    store.set(currentSubtitleAtom, {
      text: "Hello world",
      start: 0,
      end: 1000,
    })

    const { container } = render(
      <Provider store={store}>
        <TranslationSubtitle />
      </Provider>,
    )

    const pending = container.querySelector("[data-pending='true']")
    expect(pending).not.toBeNull()
    expect(pending?.querySelector("[data-subtitle-pending-indicator]")).toBeNull()

    act(() => {
      vi.advanceTimersByTime(TRANSLATION_PENDING_INDICATOR_DELAY_MS)
    })

    expect(pending?.querySelector("[data-subtitle-pending-indicator]")).not.toBeNull()
    expect(pending?.querySelectorAll("[data-subtitle-pending-dots] span")).toHaveLength(3)
    expect(screen.getByText("Translating")).toBeTruthy()
    expect(pending).toHaveAttribute("aria-label", "Translating…")
  })

  it("does not show pending placeholder when translation is an empty string", () => {
    const store = createStoreWithLanguage("eng")
    store.set(currentSubtitleAtom, {
      text: "Hello world",
      start: 0,
      end: 1000,
      translation: "",
    })

    const { container } = render(
      <Provider store={store}>
        <TranslationSubtitle />
      </Provider>,
    )

    expect(container.querySelector("[data-pending='true']")).toBeNull()
  })
})
