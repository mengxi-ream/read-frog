// @vitest-environment jsdom
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

import { MainSubtitle, TranslationSubtitle } from "../subtitle-lines"

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
  it("applies rtl attributes to translation subtitle for Arabic target language", () => {
    const store = createStoreWithLanguage("arb")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="مرحبًا" />
      </Provider>,
    )

    const line = screen.getByText("مرحبًا").closest(".subtitles-translation")!
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

    const line = screen.getByText("Hello world").closest(".subtitles-translation")!
    expect(line).toHaveAttribute("dir", "ltr")
    expect(line).toHaveAttribute("lang", "en")
  })

  it("renders block math via KaTeX in translation subtitles", () => {
    const store = createStoreWithLanguage("eng")

    const { container } = render(
      <Provider store={store}>
        <TranslationSubtitle content="Energy is $$E=mc^2$$" />
      </Provider>,
    )

    // KaTeX wraps rendered math in elements with class "katex"
    const katexEl = container.querySelector(".katex")
    expect(katexEl).not.toBeNull()
  })

  it("preserves dollar signs as currency instead of parsing as math", () => {
    const store = createStoreWithLanguage("eng")

    const { container } = render(
      <Provider store={store}>
        <TranslationSubtitle content="It costs $5 to $10" />
      </Provider>,
    )

    // Single-dollar math is disabled, so no KaTeX rendering should occur
    expect(container.querySelector(".katex")).toBeNull()
    expect(container.textContent).toContain("$5")
    expect(container.textContent).toContain("$10")
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
})
