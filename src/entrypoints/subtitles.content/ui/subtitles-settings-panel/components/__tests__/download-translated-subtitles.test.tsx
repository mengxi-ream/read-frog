// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TranslatedDownloadPhase, translatedSubtitlesDownloadStatusAtom } from "../../../../atoms"
import { DownloadTranslatedSubtitles } from "../download-translated-subtitles"
import { DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS } from "../download-translated-subtitles.constants"

const downloadTranslatedSubtitles = vi.hoisted(() => vi.fn())

vi.mock("../../../subtitles-ui-context", () => ({
  useSubtitlesUI: () => ({ downloadTranslatedSubtitles }),
}))

function renderComponent(initialStatus?: {
  phase: TranslatedDownloadPhase
  progress: number | null
}) {
  const store = createStore()
  if (initialStatus) {
    store.set(translatedSubtitlesDownloadStatusAtom, initialStatus)
  }

  render(
    <Provider store={store}>
      <DownloadTranslatedSubtitles />
    </Provider>,
  )
  return store
}

function setStatus(
  store: ReturnType<typeof createStore>,
  phase: TranslatedDownloadPhase,
  progress: number | null,
) {
  act(() => store.set(translatedSubtitlesDownloadStatusAtom, { phase, progress }))
}

describe("download translated subtitles", () => {
  afterEach(() => {
    downloadTranslatedSubtitles.mockReset()
    cleanup()
    vi.useRealTimers()
  })

  it("delegates downloads and keeps delayed feedback through checking and preparing", async () => {
    vi.useFakeTimers()
    const store = renderComponent()
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(downloadTranslatedSubtitles).toHaveBeenCalledTimes(1)

    setStatus(store, TranslatedDownloadPhase.Checking, null)
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()
    expect(button).toBeDisabled()

    await act(() => vi.advanceTimersByTime(DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS - 1))
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()

    setStatus(store, TranslatedDownloadPhase.Preparing, 0)
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTime(1))
    const message = screen.getByText("subtitles.actions.downloadTranslatedPreparing")
    expect(message).toBeInTheDocument()
    expect(message).toHaveClass("text-muted-foreground")
    expect(message).not.toHaveTextContent("(0%)")

    setStatus(store, TranslatedDownloadPhase.Idle, null)
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it("delays the preparing message and does not show preparing progress", async () => {
    vi.useFakeTimers()
    const store = renderComponent()
    const button = screen.getByRole("button")

    setStatus(store, TranslatedDownloadPhase.Preparing, 0)
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()
    expect(button).toBeDisabled()

    await act(() => vi.advanceTimersByTime(DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS - 1))
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTime(1))
    const message = screen.getByText("subtitles.actions.downloadTranslatedPreparing")
    expect(message).toBeInTheDocument()
    expect(message).toHaveClass("text-muted-foreground")
    expect(message).not.toHaveTextContent("(0%)")
  })

  it("restarts the preparing delay after a visible preparing message is cleared", async () => {
    vi.useFakeTimers()
    const store = renderComponent()

    setStatus(store, TranslatedDownloadPhase.Preparing, 0)
    await act(() => vi.advanceTimersByTime(DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS))
    expect(screen.getByText("subtitles.actions.downloadTranslatedPreparing")).toBeInTheDocument()

    setStatus(store, TranslatedDownloadPhase.Translating, 20)
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()

    setStatus(store, TranslatedDownloadPhase.Preparing, 0)
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTime(DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS - 1))
    expect(screen.queryByText("subtitles.actions.downloadTranslatedPreparing")).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText("subtitles.actions.downloadTranslatedPreparing")).toBeInTheDocument()
  })

  it("renders translating progress immediately and completion as success", () => {
    const store = renderComponent()
    const button = screen.getByRole("button")

    setStatus(store, TranslatedDownloadPhase.Translating, 45)
    const translatingMessage = screen.getByText("subtitles.actions.downloadTranslatedTranslating (45%)")
    expect(translatingMessage).toBeInTheDocument()
    expect(translatingMessage).toHaveClass("text-muted-foreground")
    expect(button).toBeDisabled()

    setStatus(store, TranslatedDownloadPhase.Complete, null)
    const completeMessage = screen.getByText("subtitles.actions.downloadTranslatedComplete")
    expect(completeMessage).toBeInTheDocument()
    expect(completeMessage).toHaveClass("text-emerald-300")
    expect(button).not.toBeDisabled()
  })
})
