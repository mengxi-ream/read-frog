// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TranslatedDownloadPhase, translatedSubtitlesDownloadStatusAtom } from "../../../../atoms"
import { DownloadTranslatedSubtitles } from "../download-translated-subtitles"

const downloadTranslatedSubtitles = vi.hoisted(() => vi.fn())

vi.mock("../../../subtitles-ui-context", () => ({
  useSubtitlesUI: () => ({ downloadTranslatedSubtitles }),
}))

function renderComponent() {
  const store = createStore()
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
  })

  it("delegates downloads and renders atom-backed phases", () => {
    const store = renderComponent()
    const button = screen.getByRole("button")
    fireEvent.click(button)
    expect(downloadTranslatedSubtitles).toHaveBeenCalledTimes(1)

    setStatus(store, TranslatedDownloadPhase.Translating, 45)
    expect(screen.getByText("subtitles.actions.downloadTranslatedTranslating (45%)")).toBeInTheDocument()
    expect(button).toBeDisabled()

    setStatus(store, TranslatedDownloadPhase.Complete, null)
    expect(screen.getByText("subtitles.actions.downloadTranslatedComplete")).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })
})
