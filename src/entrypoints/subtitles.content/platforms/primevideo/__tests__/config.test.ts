// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import { getPrimeVideoConfig } from "../config"

// Prime's player as the page has it: the video beside the controls layer, not inside it.
function renderPlayer({ controlsShown }: { controlsShown: boolean }) {
  document.body.innerHTML = `
    <div id="dv-web-player">
      <div>
        <div class="atvwebplayersdk-video-surface"><div><video></video></div></div>
        <div class="atvwebplayersdk-player-container">
          ${controlsShown ? `<div class="atvwebplayersdk-progress-bar-handle"></div>` : ""}
        </div>
      </div>
    </div>`
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("getPrimeVideoConfig", () => {
  it("mounts on a player that holds the video", () => {
    renderPlayer({ controlsShown: true })
    const { selectors } = getPrimeVideoConfig()

    const video = document.querySelector("video")
    expect(document.querySelector(selectors.video)).toBe(video)
    expect(document.querySelector(selectors.playerContainer)?.contains(video)).toBe(true)
  })

  it("reads the controls as shown only while Prime has them in the page", () => {
    const { controls, selectors } = getPrimeVideoConfig()

    renderPlayer({ controlsShown: true })
    expect(controls!.checkVisibility(document.querySelector(selectors.playerContainer)!)).toBe(true)

    renderPlayer({ controlsShown: false })
    expect(controls!.checkVisibility(document.querySelector(selectors.playerContainer)!)).toBe(
      false,
    )
  })
})
