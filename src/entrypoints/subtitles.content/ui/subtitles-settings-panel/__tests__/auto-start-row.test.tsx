// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
  subtitlesStore,
} from "../../../atoms"
import { SubtitlesProviders } from "../../subtitles-ui-context"
import { SubtitlesSettingsPanel } from "../index"

const LABEL = "subtitles.autoStartOnPlatform"

async function renderSettingsOn(platform: "bilibili" | "youtube", config: Config) {
  // The config atom rereads storage as it mounts, so storage has to hold the config too.
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
  subtitlesStore.set(configAtom, config)
  subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
  subtitlesStore.set(subtitlesSettingsPanelViewAtom, "settings")
  render(
    <SubtitlesProviders
      adapter={
        {
          platform,
          embedded: false,
          supportsAiSubtitles: false,
          supportsSidebar: false,
          getControlsConfig: () => undefined,
          toggleSubtitlesManually: vi.fn<(enabled: boolean) => void>(),
        } as any
      }
    >
      <SubtitlesSettingsPanel />
    </SubtitlesProviders>,
  )
}

async function storedPlatforms() {
  const { [CONFIG_STORAGE_KEY]: config } = await fakeBrowser.storage.local.get(CONFIG_STORAGE_KEY)
  return (config as Config).videoSubtitles.platforms
}

function configWith(platforms: Partial<Config["videoSubtitles"]["platforms"]>): Config {
  return {
    ...DEFAULT_CONFIG,
    videoSubtitles: {
      ...DEFAULT_CONFIG.videoSubtitles,
      platforms: { ...DEFAULT_CONFIG.videoSubtitles.platforms, ...platforms },
    },
  }
}

describe("the settings page's auto-start switch", () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("sets this player's platform to auto, leaving the others alone", async () => {
    await renderSettingsOn("bilibili", configWith({ youtube: "auto", netflix: "off" }))

    const autoStart = screen.getByRole("switch", { name: LABEL })
    expect(autoStart).not.toBeChecked()

    fireEvent.click(autoStart)

    await waitFor(async () => {
      expect(await storedPlatforms()).toEqual({
        ...DEFAULT_CONFIG.videoSubtitles.platforms,
        youtube: "auto",
        netflix: "off",
        bilibili: "auto",
      })
    })
    expect(screen.getByRole("switch", { name: LABEL })).toBeChecked()
  })

  it("turns auto off back to manual, never to off", async () => {
    await renderSettingsOn("youtube", configWith({ youtube: "auto" }))

    const autoStart = screen.getByRole("switch", { name: LABEL })
    expect(autoStart).toBeChecked()

    fireEvent.click(autoStart)

    await waitFor(async () => {
      expect((await storedPlatforms()).youtube).toBe("manual")
    })
  })
})
