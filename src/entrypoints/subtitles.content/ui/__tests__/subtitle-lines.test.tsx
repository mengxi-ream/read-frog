// @vitest-environment jsdom
import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ReactElement } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { deepmerge } from "deepmerge-ts"
import { Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

import { currentSubtitleAtom, subtitlesStore } from "../../atoms"
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

function createStoreWithLanguage(targetCode: LangCodeISO6393, options?: { blurTranslation?: boolean }) {
  subtitlesStore.set(mockedAtoms.languageAtom, {
    ...DEFAULT_CONFIG.language,
    targetCode,
  })
  subtitlesStore.set(mockedAtoms.videoSubtitlesAtom, {
    ...DEFAULT_CONFIG.videoSubtitles,
    style: {
      ...DEFAULT_CONFIG.videoSubtitles.style,
      blurTranslation: options?.blurTranslation ?? DEFAULT_CONFIG.videoSubtitles.style.blurTranslation,
    },
  })
  return subtitlesStore
}

function wrapWithStores(ui: ReactElement) {
  return <Provider store={subtitlesStore}>{ui}</Provider>
}

afterEach(() => {
  subtitlesStore.set(mockedAtoms.languageAtom, DEFAULT_CONFIG.language)
  subtitlesStore.set(mockedAtoms.videoSubtitlesAtom, DEFAULT_CONFIG.videoSubtitles)
  subtitlesStore.set(currentSubtitleAtom, null)
})

describe("subtitle lines", () => {
  it("applies rtl attributes to translation subtitle for Arabic target language", () => {
    createStoreWithLanguage("arb")

    render(
      wrapWithStores(
        <TranslationSubtitle content="مرحبًا" />,
      ),
    )

    const line = screen.getByText("مرحبًا")
    expect(line).toHaveAttribute("dir", "rtl")
    expect(line).toHaveAttribute("lang", "ar")
  })

  it("applies ltr attributes to translation subtitle for English target language", () => {
    createStoreWithLanguage("eng")

    render(
      wrapWithStores(
        <TranslationSubtitle content="Hello world" />,
      ),
    )

    const line = screen.getByText("Hello world")
    expect(line).toHaveAttribute("dir", "ltr")
    expect(line).toHaveAttribute("lang", "en")
  })

  it("keeps main subtitle line without forced dir/lang attributes", () => {
    createStoreWithLanguage("eng")

    render(
      wrapWithStores(
        <MainSubtitle content="Hello world" />,
      ),
    )

    const line = screen.getByText("Hello world")
    expect(line).not.toHaveAttribute("dir")
    expect(line).not.toHaveAttribute("lang")
  })

  it("blurs translation again without animation when the rendered text changes", () => {
    createStoreWithLanguage("eng", { blurTranslation: true })

    const { rerender } = render(
      wrapWithStores(
        <TranslationSubtitle content="First translation" />,
      ),
    )

    const revealedLine = screen.getByText("First translation")
    fireEvent.mouseEnter(revealedLine)
    expect(revealedLine).toHaveStyle({ filter: "blur(0)" })

    rerender(
      wrapWithStores(
        <TranslationSubtitle content="Second translation" />,
      ),
    )

    expect(screen.getByText("Second translation")).toHaveStyle({
      filter: "blur(0.25em)",
      transition: "none",
    })
  })

  it("blurs again when revisiting the same cue after leaving it", () => {
    createStoreWithLanguage("eng", { blurTranslation: true })

    const subA = { text: "", translation: "A", start: 0, end: 500 }
    const subB = { text: "", translation: "B", start: 500, end: 1000 }

    subtitlesStore.set(currentSubtitleAtom, subA)

    const { rerender } = render(wrapWithStores(<TranslationSubtitle />))

    const lineA = screen.getByText("A")
    fireEvent.mouseEnter(lineA)
    expect(lineA).toHaveStyle({ filter: "blur(0)" })

    subtitlesStore.set(currentSubtitleAtom, subB)
    rerender(wrapWithStores(<TranslationSubtitle />))
    expect(screen.getByText("B")).toHaveStyle({
      filter: "blur(0.25em)",
      transition: "none",
    })

    subtitlesStore.set(currentSubtitleAtom, subA)
    rerender(wrapWithStores(<TranslationSubtitle />))
    expect(screen.getByText("A")).toHaveStyle({
      filter: "blur(0.25em)",
      transition: "none",
    })
  })

  it("blurs again after blur is toggled off and on for the same cue", () => {
    createStoreWithLanguage("eng", { blurTranslation: true })

    const sub = { text: "", translation: "Same", start: 0, end: 500 }
    subtitlesStore.set(currentSubtitleAtom, sub)

    const { rerender } = render(wrapWithStores(<TranslationSubtitle />))

    const line = screen.getByText("Same")
    fireEvent.mouseEnter(line)
    expect(line).toHaveStyle({ filter: "blur(0)" })

    const off = subtitlesStore.get(mockedAtoms.videoSubtitlesAtom)
    subtitlesStore.set(
      mockedAtoms.videoSubtitlesAtom,
      deepmerge(off, { style: { blurTranslation: false } }),
    )
    rerender(wrapWithStores(<TranslationSubtitle />))
    expect(screen.getByText("Same")).not.toHaveStyle({ filter: "blur(0.25em)" })

    const stillOff = subtitlesStore.get(mockedAtoms.videoSubtitlesAtom)
    subtitlesStore.set(
      mockedAtoms.videoSubtitlesAtom,
      deepmerge(stillOff, { style: { blurTranslation: true } }),
    )
    rerender(wrapWithStores(<TranslationSubtitle />))

    expect(screen.getByText("Same")).toHaveStyle({
      filter: "blur(0.25em)",
      transition: "none",
    })
  })
})
