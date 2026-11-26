// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { getUdemyConfig } from "../config"

// The lecture player as Udemy renders it, with the hashes its class names carry.
function mountPlayer({ controlsHidden }: { controlsHidden: boolean }): HTMLElement {
  const player = document.createElement("div")
  player.innerHTML = `
    <div class="user-activity-module--hide-when-user-inactive--BaArl"></div>
    <div class="shaka-control-bar-module--control-bar-container--xTkMB${
      controlsHidden ? " shaka-control-bar-module--user-inactive--4wLHa" : ""
    }">
      <div data-purpose="video-controls"></div>
    </div>`
  return player
}

describe("getUdemyConfig", () => {
  it("reads the controls as shown until the control bar itself goes inactive", () => {
    const { checkVisibility } = getUdemyConfig().controls!

    expect(checkVisibility(mountPlayer({ controlsHidden: false }))).toBe(true)
    expect(checkVisibility(mountPlayer({ controlsHidden: true }))).toBe(false)
  })
})
