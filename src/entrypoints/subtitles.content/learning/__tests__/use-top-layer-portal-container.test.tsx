// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTopLayerPortalContainer } from "../use-top-layer-portal-container"

// jsdom has no Popover API: record where the card's host was each time it was asked into the top layer.
const shownIn: (Element | null)[] = []
const showPopover = vi.fn<(this: HTMLElement) => void>(function () {
  shownIn.push(getHost(this).parentElement)
})

// jsdom has no Fullscreen API either.
let fullscreenElement: Element | null = null

function getHost(container: HTMLElement) {
  return (container.getRootNode() as ShadowRoot).host
}

function addPlayer() {
  const player = document.createElement("div")
  document.body.append(player)
  return player
}

function changeFullscreen(element: Element | null) {
  fullscreenElement = element
  act(() => {
    document.dispatchEvent(new Event("fullscreenchange"))
  })
}

describe("useTopLayerPortalContainer", () => {
  beforeEach(() => {
    HTMLElement.prototype.showPopover = showPopover
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    })
  })

  afterEach(() => {
    showPopover.mockClear()
    shownIn.length = 0
    fullscreenElement = null
    document.body.replaceChildren()
  })

  it("puts the card's container in the top layer only while active", () => {
    const { result, rerender } = renderHook(({ active }) => useTopLayerPortalContainer(active), {
      initialProps: { active: false },
    })
    expect(showPopover).not.toHaveBeenCalled()

    rerender({ active: true })

    expect(showPopover.mock.contexts).toEqual([result.current])
    expect(shownIn).toEqual([document.body])
  })

  // Chrome lets nothing outside the fullscreen element take a click, top layer included.
  it("moves the card into the fullscreen element and back out, showing it on top each time", () => {
    const player = addPlayer()
    const { result } = renderHook(() => useTopLayerPortalContainer(true))
    const host = getHost(result.current)
    shownIn.length = 0

    changeFullscreen(player)
    expect(host.parentElement).toBe(player)

    changeFullscreen(null)
    expect(host.parentElement).toBe(document.body)

    expect(shownIn).toEqual([player, document.body])
  })

  it("follows fullscreen while closed, and opens inside the fullscreen element", () => {
    const player = addPlayer()
    const { result, rerender } = renderHook(({ active }) => useTopLayerPortalContainer(active), {
      initialProps: { active: false },
    })

    changeFullscreen(player)
    expect(getHost(result.current).parentElement).toBe(player)
    expect(showPopover).not.toHaveBeenCalled()

    rerender({ active: true })

    expect(shownIn).toEqual([player])
  })

  it("starts inside the fullscreen element when the page is already fullscreen", () => {
    const player = addPlayer()
    fullscreenElement = player

    const { result } = renderHook(() => useTopLayerPortalContainer(true))

    expect(getHost(result.current).parentElement).toBe(player)
    expect(shownIn).toEqual([player])
  })

  it("keeps the card's clicks from the player it sits in", () => {
    const player = addPlayer()
    fullscreenElement = player
    const onPlayerClick = vi.fn<() => void>()
    player.addEventListener("click", onPlayerClick)
    const { result } = renderHook(() => useTopLayerPortalContainer(true))
    const pin = document.createElement("button")
    result.current.append(pin)

    pin.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))

    expect(onPlayerClick).not.toHaveBeenCalled()
  })

  it("leaves the page when the card unmounts", () => {
    const player = addPlayer()
    fullscreenElement = player
    const { result, unmount } = renderHook(() => useTopLayerPortalContainer(true))
    const host = getHost(result.current)

    unmount()
    changeFullscreen(null)

    expect(host.isConnected).toBe(false)
  })
})
