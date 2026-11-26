// @vitest-environment jsdom
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
  let videoBox = box
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

  function renderPanel(embedded = false) {
    render(
      <SubtitlesProviders adapter={{ embedded, getControlsConfig: () => undefined } as any}>
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

  // Mirrors createReactShadowHost: the button renders in a shadow root inside its own host.
  function shadowHost(button: HTMLElement) {
    const host = document.createElement("div")
    host.attachShadow({ mode: "open" }).append(button)
    return host
  }

  beforeEach(() => {
    observers = []
    videoBox = box
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    // Only the menu and the video root measure as such, so measuring the wrong element fails.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.slot === "subtitles-settings-panel" ? MENU_WIDTH : 0
    })
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const panel = document.querySelector("[data-slot='subtitles-settings-panel']")
      return (
        this === panel?.parentElement?.parentElement ? videoBox : { left: 0, width: 0 }
      ) as DOMRect
    })
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

  it("re-places the menu when the video box resizes on its own", async () => {
    const button = fakeButton(500)
    subtitlesStore.set(subtitlesTranslateButtonAtom, button)
    const menu = renderPanel()

    videoBox = { left: 0, width: 1400 }
    button.getBoundingClientRect = () => ({ left: 1200, width: 48 }) as DOMRect
    await resized(menu.parentElement!)

    expect(menu.style.left).toBe(
      `${getMenuLeft({ left: 1200, width: 48 }, videoBox, MENU_WIDTH)}px`,
    )
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
    row.append(shadowHost(button))
    subtitlesStore.set(subtitlesTranslateButtonAtom, button)
    const menu = renderPanel()

    button.getBoundingClientRect = () => ({ left: 511, width: 48 }) as DOMRect
    await resized(row)

    expect(menu.style.left).toBe(`${getMenuLeft({ left: 511, width: 48 }, box, MENU_WIDTH)}px`)
  })

  it("watches the row a remounted button lands in", async () => {
    subtitlesStore.set(subtitlesTranslateButtonAtom, fakeButton(500))
    const menu = renderPanel()
    const remounted = fakeButton(800)
    const host = shadowHost(remounted)
    await act(async () => subtitlesStore.set(subtitlesTranslateButtonAtom, remounted))

    const row = document.createElement("div")
    row.append(host)
    await resized(remounted)
    remounted.getBoundingClientRect = () => ({ left: 811, width: 48 }) as DOMRect
    await resized(row)

    expect(menu.style.left).toBe(`${getMenuLeft({ left: 811, width: 48 }, box, MENU_WIDTH)}px`)
  })

  it("stays inside a shrunken video while the button is gone with the controls", async () => {
    const button = fakeButton(900)
    subtitlesStore.set(subtitlesTranslateButtonAtom, button)
    const menu = renderPanel()
    const placed = getMenuLeft({ left: 900, width: 48 }, box, MENU_WIDTH)

    button.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect
    videoBox = { left: 100, width: 600 }
    await act(async () => {
      window.dispatchEvent(new Event("resize"))
    })

    expect(clampMenuLeft(placed, 600, MENU_WIDTH)).toBeLessThan(placed)
    expect(menu.style.left).toBe(`${clampMenuLeft(placed, 600, MENU_WIDTH)}px`)
  })

  it("places the menu in the frame's viewport when it lives in an embedded player's controls", () => {
    vi.stubGlobal("self", {})
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(800)
    subtitlesStore.set(subtitlesTranslateButtonAtom, fakeButton(500))

    const menu = renderPanel(true)

    expect(menu).toHaveClass("fixed")
    expect(menu.style.left).toBe(
      `${getMenuLeft({ left: 500, width: 48 }, { left: 0, width: 800 }, MENU_WIDTH)}px`,
    )
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

  it("keeps a newer button registered when the old one unmounts after it", () => {
    const renderButton = () =>
      render(
        <SubtitlesProviders
          adapter={{ embedded: false, getControlsConfig: () => undefined } as any}
        >
          <SubtitlesTranslateButton />
        </SubtitlesProviders>,
      )
    const old = renderButton()
    renderButton()
    const [, newer] = screen.getAllByRole("button", { name: "Subtitle Translation Panel" })

    old.unmount()

    expect(subtitlesStore.get(subtitlesTranslateButtonAtom)).toBe(newer)
  })
})
