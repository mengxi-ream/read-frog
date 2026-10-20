// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { createShortsTranslateButtonMount } from "../mount-shorts-translate-button"

vi.mock("../render-translate-button", () => ({
  renderSubtitlesTranslateButton: () => {
    const existing = document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
    if (existing) return existing
    const host = document.createElement("div")
    host.id = TRANSLATE_BUTTON_CONTAINER_ID
    return host
  },
}))

function renderControls() {
  document.body.innerHTML = `
    <div id="reel-overlay-container">
      <ytd-shorts-player-controls>
        <div id="right-controls"><div id="menu-button"></div></div>
      </ytd-shorts-player-controls>
    </div>
  `
  return document.getElementById("right-controls")!
}

describe("createShortsTranslateButtonMount", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("puts the button first in the reel controls and removes it on dispose", async () => {
    const controls = renderControls()
    const { mount, dispose } = createShortsTranslateButtonMount({} as any)

    await mount()
    expect(controls.firstElementChild?.id).toBe(TRANSLATE_BUTTON_CONTAINER_ID)

    dispose()
    expect(document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)).toBeNull()
  })

  it("backs out of a mount whose controls only appear after dispose", async () => {
    const { mount, dispose } = createShortsTranslateButtonMount({} as any)

    const mounting = mount()
    dispose()
    const controls = renderControls()
    await mounting

    expect(controls.querySelector(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)).toBeNull()
  })
})
