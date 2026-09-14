// @vitest-environment jsdom
import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useControlsInfo } from "../use-controls-visible"

function mountPlayer(height: number) {
  const player = document.createElement("div")
  player.getBoundingClientRect = () => ({ height }) as DOMRect
  const host = document.createElement("div")
  const shadowRoot = host.attachShadow({ mode: "open" })
  const element = document.createElement("div")
  shadowRoot.append(element)
  player.append(host)
  document.body.append(player)
  return { player, element }
}

function configMeasuring(height: number): ControlsConfig {
  return {
    measureHeight: () => height,
    checkVisibility: () => true,
  }
}

describe("useControlsInfo", () => {
  it("reports the measured controls height", () => {
    const { element } = mountPlayer(495)
    const { result } = renderHook(() => useControlsInfo({ current: element }, configMeasuring(59)))

    expect(result.current).toEqual({ controlsVisible: true, controlsHeight: 59 })
  })

  it("caps a controls height that spans the whole player", () => {
    const { element } = mountPlayer(495)
    const { result } = renderHook(() => useControlsInfo({ current: element }, configMeasuring(495)))

    expect(result.current.controlsHeight).toBeCloseTo(495 * 0.25)
  })
})
