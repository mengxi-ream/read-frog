// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
  subtitlesStore,
} from "../../../atoms"
import { SubtitlesProviders } from "../../subtitles-ui-context"
import { SubtitlesSettingsPanel } from "../index"
import { ROOT_VIEW } from "../views"

const downloadSourceSubtitles = vi.fn<() => Promise<void>>()
const downloadTranslatedSubtitles = vi.fn<() => Promise<void>>()

function renderPanel() {
  render(
    <SubtitlesProviders
      adapter={
        {
          embedded: false,
          supportsAiSubtitles: false,
          supportsSidebar: false,
          getControlsConfig: () => undefined,
          toggleSubtitlesManually: vi.fn<(enabled: boolean) => void>(),
          downloadSourceSubtitles,
          downloadTranslatedSubtitles,
        } as any
      }
    >
      <SubtitlesSettingsPanel />
    </SubtitlesProviders>,
  )
}

const button = (name: string) => screen.getByRole("button", { name })
const back = () => fireEvent.click(button("Back to subtitles menu"))

describe("subtitles settings panel navigation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    )
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, ROOT_VIEW)
    downloadSourceSubtitles.mockReset().mockResolvedValue(undefined)
    downloadTranslatedSubtitles.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("groups both downloads behind one entry, each row being its own button", async () => {
    renderPanel()

    expect(screen.queryByText("subtitles.actions.downloadSource")).not.toBeInTheDocument()
    fireEvent.click(button("subtitles.actions.download"))

    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe("download")
    await act(async () => fireEvent.click(button("subtitles.actions.downloadSource")))
    expect(downloadSourceSubtitles).toHaveBeenCalledTimes(1)
    fireEvent.click(button("subtitles.actions.downloadTranslated"))
    expect(downloadTranslatedSubtitles).toHaveBeenCalledTimes(1)

    back()
    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe(ROOT_VIEW)
  })

  it("nests the style page under settings and steps back one level at a time", () => {
    renderPanel()

    fireEvent.click(button("subtitles.settings"))
    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe("settings")
    expect(
      screen.getByRole("combobox", { name: "options.videoSubtitles.style.displayMode.title" }),
    ).toBeInTheDocument()

    fireEvent.click(button("options.videoSubtitles.style.title"))
    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe("style")
    expect(screen.getByText("options.videoSubtitles.style.backgroundOpacity")).toBeInTheDocument()
    // Display mode moved up to the settings page, so the style page no longer repeats it.
    expect(
      screen.queryByText("options.videoSubtitles.style.displayMode.title"),
    ).not.toBeInTheDocument()

    back()
    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe("settings")

    back()
    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe(ROOT_VIEW)
  })
})
