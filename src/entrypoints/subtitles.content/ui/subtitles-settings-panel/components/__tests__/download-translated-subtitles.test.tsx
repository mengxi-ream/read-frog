// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import { subtitlesSettingsPanelOpenAtom } from "../../../../atoms"
import { DownloadTranslatedSubtitles } from "../download-translated-subtitles"

const mocks = vi.hoisted(() => ({
  downloadTranslatedSubtitles: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
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
    vi.mocked(toast.error).mockReset()
    cleanup()
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

  it("shows toast on failure", async () => {
    mocks.downloadTranslatedSubtitles.mockRejectedValue(new Error("Export failed"))

    renderDownloadTranslatedSubtitles()

    fireEvent.click(screen.getByLabelText("subtitles.actions.downloadTranslated"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Export failed")
    })
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument()
  })
})
