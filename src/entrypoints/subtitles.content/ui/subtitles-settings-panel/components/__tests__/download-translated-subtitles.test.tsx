// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { subtitlesSettingsPanelOpenAtom } from "../../../../atoms"
import { DownloadTranslatedSubtitles } from "../download-translated-subtitles"

const mocks = vi.hoisted(() => ({
  downloadTranslatedSubtitles: vi.fn(),
}))

vi.mock("../../../subtitles-ui-context", () => ({
  useSubtitlesUI: () => ({
    downloadTranslatedSubtitles: mocks.downloadTranslatedSubtitles,
  }),
}))

function renderDownloadTranslatedSubtitles() {
  const store = createStore()
  store.set(subtitlesSettingsPanelOpenAtom, true)

  const view = render(
    <Provider store={store}>
      <DownloadTranslatedSubtitles />
    </Provider>,
  )

  return { store, ...view }
}

describe("download translated subtitles", () => {
  afterEach(() => {
    mocks.downloadTranslatedSubtitles.mockReset()
    cleanup()
    vi.useRealTimers()
  })

  it("shows export progress in the settings row", async () => {
    let finishDownload!: () => void
    let reportProgress!: (progress: number) => void
    mocks.downloadTranslatedSubtitles.mockImplementation(async (onProgress: (progress: number) => void) => {
      reportProgress = onProgress
      await new Promise<void>((resolve) => {
        finishDownload = resolve
      })
    })

    renderDownloadTranslatedSubtitles()

    fireEvent.click(screen.getByLabelText("subtitles.actions.downloadTranslated"))

    expect(await screen.findByText("subtitles.actions.downloadTranslatedPreparing (0%)")).toBeInTheDocument()

    await act(async () => {
      reportProgress(45)
    })

    expect(await screen.findByText("subtitles.actions.downloadTranslatedTranslating (45%)")).toBeInTheDocument()

    await act(async () => {
      finishDownload()
    })

    await waitFor(() => {
      expect(screen.queryByText("subtitles.actions.downloadTranslatedTranslating (45%)")).not.toBeInTheDocument()
    })
    expect(screen.getByText("subtitles.actions.downloadTranslatedComplete")).toBeInTheDocument()
  })

  it("clears the success message after a short delay", async () => {
    vi.useFakeTimers()
    mocks.downloadTranslatedSubtitles.mockResolvedValue(undefined)

    renderDownloadTranslatedSubtitles()

    fireEvent.click(screen.getByLabelText("subtitles.actions.downloadTranslated"))

    await act(async () => {})

    expect(screen.getByText("subtitles.actions.downloadTranslatedComplete")).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3999)
    })

    expect(screen.getByText("subtitles.actions.downloadTranslatedComplete")).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(screen.queryByText("subtitles.actions.downloadTranslatedComplete")).not.toBeInTheDocument()
  })

  it("clears status when the settings panel closes after download finishes", async () => {
    mocks.downloadTranslatedSubtitles.mockResolvedValue(undefined)
    const { store } = renderDownloadTranslatedSubtitles()

    fireEvent.click(screen.getByLabelText("subtitles.actions.downloadTranslated"))

    expect(await screen.findByText("subtitles.actions.downloadTranslatedComplete")).toBeInTheDocument()

    await act(async () => {
      store.set(subtitlesSettingsPanelOpenAtom, false)
    })

    expect(screen.queryByText("subtitles.actions.downloadTranslatedComplete")).not.toBeInTheDocument()
  })
})
