// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTopLayerPortalContainer } from "../use-top-layer-portal-container"

// jsdom has no Popover API: record which elements were asked into the top layer.
const showPopover = vi.fn<() => void>()

describe("useTopLayerPortalContainer", () => {
  beforeEach(() => {
    HTMLElement.prototype.showPopover = showPopover
  })

  afterEach(() => {
    showPopover.mockClear()
  })

  it("puts the card's container in the top layer only while active", () => {
    const { result, rerender } = renderHook(({ active }) => useTopLayerPortalContainer(active), {
      initialProps: { active: false },
    })
    expect(showPopover).not.toHaveBeenCalled()

    rerender({ active: true })

    expect(showPopover.mock.contexts).toEqual([result.current])
  })

  it("goes back on top when the page enters fullscreen, so the card shows over the video", () => {
    const { result } = renderHook(() => useTopLayerPortalContainer(true))
    showPopover.mockClear()

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"))
    })

    expect(showPopover.mock.contexts).toEqual([result.current])
  })
})
