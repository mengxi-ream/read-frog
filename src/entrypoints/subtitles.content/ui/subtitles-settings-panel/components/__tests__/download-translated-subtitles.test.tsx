// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DownloadTranslatedSubtitles } from "../download-translated-subtitles"

const mocks = vi.hoisted(() => ({
  downloadTranslatedSubtitles: vi.fn(),
}))

vi.mock("../../../subtitles-ui-context", () => ({
  useSubtitlesUI: () => ({
    downloadTranslatedSubtitles: mocks.downloadTranslatedSubtitles,
  }),
}))

describe("download translated subtitles", () => {
  it("shows export progress in the settings row", async () => {
    let finishDownload!: () => void
    let reportProgress!: (progress: number) => void
    mocks.downloadTranslatedSubtitles.mockImplementation(async (onProgress: (progress: number) => void) => {
      reportProgress = onProgress
      await new Promise<void>((resolve) => {
        finishDownload = resolve
      })
    })

    render(<DownloadTranslatedSubtitles />)

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
})
