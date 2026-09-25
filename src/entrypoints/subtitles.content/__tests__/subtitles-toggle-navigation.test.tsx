// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { subtitlesSettingsPanelOpenAtom, subtitlesStore, subtitlesVisibleAtom } from "../atoms"
import { SubtitlesSettingsPanel } from "../ui/subtitles-settings-panel"
import { SubtitlesTranslateButton } from "../ui/subtitles-translate-button"
import { SubtitlesProviders } from "../ui/subtitles-ui-context"

const toggleSubtitlesManually = vi.fn<(enabled: boolean) => void>()

describe("subtitles toggle across navigation", () => {
  beforeEach(() => {
    subtitlesStore.set(subtitlesVisibleAtom, true)
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
    toggleSubtitlesManually.mockClear()
  })

  afterEach(cleanup)

  it("reflects the next video's off state after the hidden panel opens", () => {
    render(
      <SubtitlesProviders
        adapter={
          {
            embedded: false,
            supportsAiSubtitles: false,
            supportsSidebar: false,
            getControlsConfig: () => undefined,
            toggleSubtitlesManually,
          } as any
        }
      >
        <SubtitlesTranslateButton />
        <SubtitlesSettingsPanel />
      </SubtitlesProviders>,
    )

    const toggle = screen.getByRole("switch")
    expect(toggle).toHaveAttribute("data-checked")
    expect(screen.getByText("ON")).toBeInTheDocument()

    act(() => subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false))
    act(() => subtitlesStore.set(subtitlesVisibleAtom, false))
    act(() => subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true))

    expect(screen.getByRole("switch")).toHaveAttribute("data-unchecked")
    expect(screen.getByText("OFF")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("switch"))
    expect(toggleSubtitlesManually).toHaveBeenCalledWith(true)
  })
})
