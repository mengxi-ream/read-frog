// @vitest-environment jsdom
import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useControlsInfo } from "../use-controls-visible"

let resizeCallbacks: Array<() => void> = []

class FakeResizeObserver {
  constructor(callback: () => void) {
    resizeCallbacks.push(callback)
  }

  observe() {}

  disconnect() {}
}

beforeEach(() => {
  resizeCallbacks = []
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
})

function mountPlayer(height: number) {
  const player = document.createElement("div")
  let currentHeight = height
  player.getBoundingClientRect = () => ({ height: currentHeight }) as DOMRect
  const host = document.createElement("div")
  const shadowRoot = host.attachShadow({ mode: "open" })
  const element = document.createElement("div")
  shadowRoot.append(element)
  player.append(host)
  document.body.append(player)
  return {
    player,
    element,
    resize: (next: number) => {
      currentHeight = next
      act(() => resizeCallbacks.forEach((callback) => callback()))
    },
  }
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

  it("recomputes the cap when the player resizes without a class change", () => {
    const { element, resize } = mountPlayer(495)
    const { result } = renderHook(() => useControlsInfo({ current: element }, configMeasuring(495)))

    resize(200)

    expect(result.current.controlsHeight).toBeCloseTo(200 * 0.25)
  })
})
