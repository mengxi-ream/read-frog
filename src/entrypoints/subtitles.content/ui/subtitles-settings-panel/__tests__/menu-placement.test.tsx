// @vitest-environment jsdom
import type { MockInstance } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesStore,
  subtitlesTranslateButtonAtom,
} from "../../../atoms"
import { SubtitlesTranslateButton } from "../../subtitles-translate-button"
import { SubtitlesProviders } from "../../subtitles-ui-context"
import { SubtitlesSettingsPanel } from "../index"
import { clampMenuLeft, getMenuLeft, MENU_EDGE_MARGIN } from "../menu-placement"

const box = { left: 100, width: 1000 }
const MENU_WIDTH = 272

describe("getMenuLeft", () => {
  it("lines the menu's left edge up with the button's", () => {
    expect(getMenuLeft({ left: 500, width: 48 }, box, MENU_WIDTH)).toBe(500 - 100)
  })

  it("lines up the right edges instead when the menu has no room right of the button", () => {
    expect(getMenuLeft({ left: 900, width: 48 }, box, MENU_WIDTH)).toBe(900 + 48 - 100 - MENU_WIDTH)
  })

  it("keeps the menu inside the box when the button is near either edge", () => {
    expect(getMenuLeft({ left: 1040, width: 48 }, box, MENU_WIDTH)).toBe(
      1000 - MENU_WIDTH - MENU_EDGE_MARGIN,
    )
    expect(getMenuLeft({ left: 110, width: 48 }, box, MENU_WIDTH)).toBe(MENU_EDGE_MARGIN)
  })

  it("holds the menu at the left margin in a box narrower than the menu", () => {
    expect(getMenuLeft({ left: 150, width: 48 }, { left: 100, width: 200 }, MENU_WIDTH)).toBe(
      MENU_EDGE_MARGIN,
    )
  })
})

describe("settings panel placement", () => {
  let boxRect: MockInstance<() => DOMRect>
  let observers: FakeResizeObserver[] = []

  class FakeResizeObserver {
    targets: Element[] = []
    callback: () => void

    constructor(callback: () => void) {
      this.callback = callback
      observers.push(this)
    }

    observe(target: Element) {
      this.targets.push(target)
    }

    disconnect() {
      observers = observers.filter((observer) => observer !== this)
    }
  }

  async function resized(target: Element) {
    await act(async () => {
      for (const observer of observers) {
        if (observer.targets.includes(target)) observer.callback()
      }
    })
  }

  function renderPanel() {
    render(
      <SubtitlesProviders adapter={{ embedded: false, getControlsConfig: () => undefined } as any}>
        <SubtitlesSettingsPanel />
      </SubtitlesProviders>,
    )
    return document.querySelector<HTMLElement>("[data-slot='subtitles-settings-panel']")!
      .parentElement!
  }

  function fakeButton(left: number, width = 48) {
    const button = document.createElement("button")
    // An own method: spying on the instance would reuse the prototype spy every element shares.
    button.getBoundingClientRect = () => ({ left, width }) as DOMRect
    return button
  }

  beforeEach(() => {
    observers = []
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(MENU_WIDTH)
    boxRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(box as DOMRect)
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesTranslateButtonAtom, null)
  })

  it("opens over the translate button rather than at the video's right edge", () => {
    subtitlesStore.set(subtitlesTranslateButtonAtom, fakeButton(500))

    const menu = renderPanel()

    expect(menu.style.left).toBe(`${getMenuLeft({ left: 500, width: 48 }, box, MENU_WIDTH)}px`)
    expect(menu).not.toHaveClass("right-4")
  })

  it("keeps to the right edge when there is no button to follow", () => {
    const menu = renderPanel()

    expect(menu.style.left).toBe("")
    expect(menu).toHaveClass("right-4")
  })

  it("moves to a remounted button once its host is in the page", async () => {
    subtitlesStore.set(subtitlesTranslateButtonAtom, fakeButton(500))
    const menu = renderPanel()

    // Platforms render the new button first and insert its host after, so it registers with no box.
    const remounted = fakeButton(0, 0)
    await act(async () => subtitlesStore.set(subtitlesTranslateButtonAtom, remounted))
    remounted.getBoundingClientRect = () => ({ left: 800, width: 48 }) as DOMRect
    await resized(remounted)

    expect(menu.style.left).toBe(`${getMenuLeft({ left: 800, width: 48 }, box, MENU_WIDTH)}px`)
  })

  it("follows the button when a control beside it changes width", async () => {
    const button = fakeButton(500)
    const row = document.createElement("div")
    row.append(button)
    subtitlesStore.set(subtitlesTranslateButtonAtom, button)
    const menu = renderPanel()

    button.getBoundingClientRect = () => ({ left: 511, width: 48 }) as DOMRect
    await resized(row)

    expect(menu.style.left).toBe(`${getMenuLeft({ left: 511, width: 48 }, box, MENU_WIDTH)}px`)
  })

  it("stays inside a shrunken video while the button is gone with the controls", async () => {
    const button = fakeButton(900)
    subtitlesStore.set(subtitlesTranslateButtonAtom, button)
    const menu = renderPanel()
    const placed = getMenuLeft({ left: 900, width: 48 }, box, MENU_WIDTH)

    button.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect
    boxRect.mockReturnValue({ left: 100, width: 600 } as DOMRect)
    await act(async () => {
      window.dispatchEvent(new Event("resize"))
    })

    expect(clampMenuLeft(placed, 600, MENU_WIDTH)).toBeLessThan(placed)
    expect(menu.style.left).toBe(`${clampMenuLeft(placed, 600, MENU_WIDTH)}px`)
  })

  it("registers the mounted translate button and lets it go on unmount", () => {
    const { unmount } = render(
      <SubtitlesProviders adapter={{ embedded: false, getControlsConfig: () => undefined } as any}>
        <SubtitlesTranslateButton />
      </SubtitlesProviders>,
    )

    expect(subtitlesStore.get(subtitlesTranslateButtonAtom)).toBe(
      screen.getByRole("button", { name: "Subtitle Translation Panel" }),
    )
    unmount()
    expect(subtitlesStore.get(subtitlesTranslateButtonAtom)).toBeNull()
  })
})
