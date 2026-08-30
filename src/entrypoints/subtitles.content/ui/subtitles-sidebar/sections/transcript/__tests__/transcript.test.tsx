// @vitest-environment jsdom
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Provider as JotaiProvider } from "jotai"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { TranscriptSection } from ".."
import {
  currentTimeMsAtom,
  currentVideoIdAtom,
  sourceTrackAtom,
  subtitlesStore,
  translatedTrackAtom,
} from "../../../../../atoms"
import { SubtitlesUIContext } from "../../../../subtitles-ui-context"

const CUES: SubtitlesFragment[] = [
  { text: "first line", start: 0, end: 1000 },
  { text: "second line", start: 1000, end: 2000 },
  { text: "third line", start: 2000, end: 3000 },
]

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn<() => void>()
  window.matchMedia = vi.fn<() => MediaQueryList>().mockReturnValue({
    matches: false,
  } as MediaQueryList)
})

function renderTranscript({ preloaded = true }: { preloaded?: boolean } = {}) {
  const seekTo = vi.fn<(seconds: number) => void>()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ensureSourceTrackPublished = vi.fn<() => Promise<void>>(async () => {
    subtitlesStore.set(sourceTrackAtom, CUES)
  })

  act(() => {
    subtitlesStore.set(currentVideoIdAtom, "video-1")
    subtitlesStore.set(translatedTrackAtom, [])
    subtitlesStore.set(sourceTrackAtom, preloaded ? CUES : [])
    subtitlesStore.set(currentTimeMsAtom, 0)
  })

  render(
    <JotaiProvider store={subtitlesStore}>
      <QueryClientProvider client={client}>
        <SubtitlesUIContext
          value={
            {
              ensureSourceTrackPublished,
              seekTo,
            } as never
          }
        >
          <TranscriptSection />
        </SubtitlesUIContext>
      </QueryClientProvider>
    </JotaiProvider>,
  )

  return { seekTo, ensureSourceTrackPublished }
}

function playAt(timeMs: number) {
  act(() => {
    subtitlesStore.set(currentTimeMsAtom, timeMs)
  })
}

afterEach(() => {
  cleanup()
  act(() => {
    subtitlesStore.set(sourceTrackAtom, [])
    subtitlesStore.set(translatedTrackAtom, [])
    subtitlesStore.set(currentTimeMsAtom, 0)
  })
})

describe("transcriptSection", () => {
  it("renders a row per source cue", () => {
    renderTranscript()

    expect(screen.getByText("first line")).toBeTruthy()
    expect(screen.getByText("third line")).toBeTruthy()
  })

  it("moves the current row as playback advances", () => {
    renderTranscript()

    playAt(1500)

    const current = document.querySelector("[aria-current]")
    expect(current?.textContent).toContain("second line")
  })

  it("marks no row while the playhead sits in a gap", () => {
    renderTranscript()

    playAt(9000)

    expect(document.querySelector("[aria-current]")).toBeNull()
  })

  it("follows playback after the track arrives from the query", async () => {
    renderTranscript({ preloaded: false })

    await screen.findByText("second line")
    playAt(1500)

    const current = document.querySelector("[aria-current]")
    expect(current?.textContent).toContain("second line")
  })

  it("seeks to the start of the row that was clicked", () => {
    const { seekTo } = renderTranscript()

    fireEvent.click(screen.getByText("third line"))

    expect(seekTo).toHaveBeenCalledWith(2)
  })
})
