// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { DEFAULT_CONTROLS_HEIGHT } from "@/utils/constants/subtitles"
import { getYoutubeConfig } from "../config"

function withHeight(element: HTMLElement, height: number) {
  element.getBoundingClientRect = () => ({ height }) as DOMRect
  return element
}

function buildPlayer({ strayProgressBar = false } = {}) {
  const player = withHeight(document.createElement("div"), 495)
  player.className = "html5-video-player"

  if (strayProgressBar) {
    const stray = document.createElement("div")
    stray.className = "ytp-progress-bar-container"
    player.append(stray)
  }

  const chromeBottom = withHeight(document.createElement("div"), 59)
  chromeBottom.className = "ytp-chrome-bottom"
  const progressBar = document.createElement("div")
  progressBar.className = "ytp-progress-bar-container"
  chromeBottom.append(progressBar)
  player.append(chromeBottom)

  document.body.append(player)
  return player
}

function measureHeight(container: HTMLElement) {
  const { controls } = getYoutubeConfig({ mode: "watch" })
  if (!controls) throw new Error("watch config has no controls")
  return controls.measureHeight(container)
}

describe("youtube watch controls measureHeight", () => {
  it("measures the controls bar", () => {
    expect(measureHeight(buildPlayer())).toBe(59)
  })

  it("ignores the progress bar the miniplayer leaves on the player root", () => {
    expect(measureHeight(buildPlayer({ strayProgressBar: true }))).toBe(59)
  })

  it("falls back to the default height without a controls bar", () => {
    const player = document.createElement("div")
    player.className = "html5-video-player"

    expect(measureHeight(player)).toBe(DEFAULT_CONTROLS_HEIGHT)
  })
})
