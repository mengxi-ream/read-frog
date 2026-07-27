// @vitest-environment jsdom
import type { FloatingButtonConfig } from "@/types/config/floating-button"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { atom, createStore, Provider } from "jotai"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { sendMessage } from "@/utils/message"
import FloatingButton from ".."

const toastAddMock = vi.fn<(...args: any[]) => any>()

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: (path = "") => `chrome-extension://test-extension${path}`,
      getManifest: () => ({ version: "1.43.3" }),
    },
  },
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/utils/atoms/config", () => {
  const floatingButtonBaseAtom = atom<FloatingButtonConfig>({
    enabled: true,
    position: 0.66,
    side: "right",
    clickAction: "panel",
    disabledFloatingButtonPatterns: [],
    locked: false,
  })
  const floatingButtonAtom = atom(
    (get) => get(floatingButtonBaseAtom),
    (get, set, patch: Partial<FloatingButtonConfig>) => {
      set(floatingButtonBaseAtom, {
        ...get(floatingButtonBaseAtom),
        ...patch,
      })
    },
  )

  return {
    configFieldsAtomMap: {
      floatingButton: floatingButtonAtom,
      sideContent: atom({ width: 360 }),
      uiLanguage: atom("en"),
    },
  }
})

vi.mock("../../../atoms", () => ({
  enablePageTranslationAtom: atom({ enabled: false }),
  isDraggingButtonAtom: atom(false),
  isSideOpenAtom: atom(false),
}))

vi.mock("../../../index", () => ({
  shadowWrapper: document.body,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/i18n/locale-map", () => ({
  resolveUiLocale: (uiLanguage: string) => (uiLanguage === "auto" ? "en" : uiLanguage),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  anchoredToastManager: {
    add: (...args: unknown[]) => toastAddMock(...args),
  },
}))

beforeAll(() => {
  vi.stubEnv("BROWSER", "chrome")

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(sendMessage).mockReset()
  toastAddMock.mockReset()
  window.history.replaceState({}, "", "/")
  setViewport(1024, 768)
})

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  })
}

function renderFloatingButton(floatingButtonOverrides: Partial<FloatingButtonConfig> = {}) {
  const store = createStore()
  void store.set(configFieldsAtomMap.floatingButton, floatingButtonOverrides)

  return {
    store,
    ...render(
      <Provider store={store}>
        <FloatingButton />
      </Provider>,
    ),
  }
}

function getMainButton() {
  return screen.getByTestId("floating-main-button")
}

function getFloatingButtonConfig(store: ReturnType<typeof createStore>) {
  return store.get(configFieldsAtomMap.floatingButton)
}

function mockRect(element: Element, rect: Partial<DOMRect>) {
  const left = rect.left ?? 0
  const top = rect.top ?? 0
  const width = rect.width ?? 0
  const height = rect.height ?? 0
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: rect.right ?? left + width,
    bottom: rect.bottom ?? top + height,
    toJSON: () => {},
  })
}

const TOOLTIP_CONTROL_LABELS = [
  "options.floatingButtonAndToolbar.floatingButton.tooltips.togglePageTranslation",
  "options.floatingButtonAndToolbar.floatingButton.tooltips.settings",
  "options.floatingButtonAndToolbar.floatingButton.tooltips.feedback",
] as const

async function expectTooltipSide(label: string, side: "left" | "right") {
  const trigger = screen.getByRole("button", { name: label })
  fireEvent.focus(trigger)

  await waitFor(() => {
    const popup = document.querySelector<HTMLElement>('[data-slot="tooltip-content"][data-open]')
    expect(popup).toHaveTextContent(label)
    expect(popup).toHaveAttribute("data-side", side)
    expect(popup).toHaveClass("pointer-events-none")
    expect(popup?.parentElement).toHaveClass("pointer-events-none")
  })

  fireEvent.blur(trigger)
  await waitFor(() => {
    expect(document.querySelector('[data-slot="tooltip-content"][data-open]')).toBeNull()
  })
}

describe("floatingButton controls", () => {
  it("shows the close trigger only after entering the main floating button", () => {
    renderFloatingButton()

    const closeTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.floatingButtonOptions",
    })
    const mainButton = getMainButton()

    expect(mainButton).toHaveClass("transition-transform")
    expect(mainButton).toHaveClass("duration-300")
    expect(closeTrigger).toHaveClass("-top-1")
    expect(closeTrigger).toHaveClass("left-0")
    expect(closeTrigger).toHaveClass("invisible")
    expect(closeTrigger).toHaveClass("pointer-events-none")
    expect(closeTrigger).toHaveClass("text-neutral-300")
    expect(closeTrigger).toHaveClass("hover:scale-110")
    expect(closeTrigger).toHaveClass("active:scale-90")
    expect(closeTrigger).toHaveClass("hover:text-neutral-500")
    expect(closeTrigger).toHaveClass("active:text-neutral-500")

    fireEvent.mouseEnter(mainButton)

    expect(closeTrigger).toHaveClass("visible")
    expect(closeTrigger).toHaveClass("pointer-events-auto")
    expect(closeTrigger).toHaveClass("-left-6")
  })

  it("renders a lock trigger at the lower-left corner and keeps controls expanded after entering the main button", () => {
    renderFloatingButton()

    const lockTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.lockPosition",
    })
    const mainButton = getMainButton()
    const floatingButtonContainer = screen.getByTestId("floating-button-container")

    expect(lockTrigger).toHaveClass("left-0")
    expect(lockTrigger).toHaveClass("-bottom-1")
    expect(lockTrigger).toHaveClass("invisible")
    expect(lockTrigger).toHaveClass("pointer-events-none")
    expect(lockTrigger).toHaveClass("text-neutral-300")
    expect(lockTrigger).toHaveClass("hover:scale-110")
    expect(lockTrigger).toHaveClass("active:scale-90")
    expect(lockTrigger).toHaveClass("hover:text-neutral-500")
    expect(lockTrigger).toHaveClass("active:text-neutral-500")
    expect(mainButton).toHaveClass("translate-x-6")

    fireEvent.mouseEnter(mainButton)

    expect(lockTrigger).toHaveClass("visible")
    expect(lockTrigger).toHaveClass("pointer-events-auto")
    expect(lockTrigger).toHaveClass("-left-6")
    expect(mainButton).toHaveClass("translate-x-0")

    fireEvent.click(lockTrigger)

    const unlockTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.unlockPosition",
    })

    expect(unlockTrigger).toHaveClass("text-neutral-300")
    expect(unlockTrigger).toHaveClass("-left-6")
    expect(mainButton).toHaveClass("translate-x-0")
    expect(mainButton).toHaveClass("opacity-100")
    expect(mainButton).not.toHaveClass("translate-x-6")

    fireEvent.mouseLeave(floatingButtonContainer)

    expect(mainButton).toHaveClass("translate-x-0")
    expect(mainButton).toHaveClass("opacity-60")

    fireEvent.mouseEnter(mainButton)

    expect(mainButton).toHaveClass("opacity-100")
  })

  it("does not show a tooltip for options and keeps its trigger visible while the dropdown is open", () => {
    renderFloatingButton()

    const closeTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.floatingButtonOptions",
    })
    const mainButton = getMainButton()

    fireEvent.mouseEnter(mainButton)
    fireEvent.focus(closeTrigger)
    expect(document.querySelector('[data-slot="tooltip-content"][data-open]')).toBeNull()
    fireEvent.click(closeTrigger)

    expect(closeTrigger).toHaveClass("visible")
    expect(closeTrigger).toHaveClass("pointer-events-auto")
    expect(document.querySelector('[data-slot="tooltip-content"][data-open]')).toBeNull()
    expect(
      screen.getByText("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableForSite"),
    ).toBeInTheDocument()
  })

  it("does not show a tooltip for the lock control", () => {
    renderFloatingButton()
    fireEvent.mouseEnter(getMainButton())

    const lockTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.lockPosition",
    })
    fireEvent.focus(lockTrigger)

    expect(document.querySelector('[data-slot="tooltip-content"][data-open]')).toBeNull()
  })

  it.each([
    { floatingSide: "right", tooltipSide: "left" },
    { floatingSide: "left", tooltipSide: "right" },
  ] as const)(
    "opens each directional tooltip on the $tooltipSide when docked to the $floatingSide",
    async ({ floatingSide, tooltipSide }) => {
      renderFloatingButton({ side: floatingSide })
      fireEvent.mouseEnter(getMainButton())
      expect(TOOLTIP_CONTROL_LABELS).toHaveLength(3)

      for (const label of TOOLTIP_CONTROL_LABELS) {
        await expectTooltipSide(label, tooltipSide)
      }
    },
  )

  it("toggles the browser side panel on a normal panel click", () => {
    vi.useFakeTimers()
    renderFloatingButton({ clickAction: "panel" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })

    expect(sendMessage).toHaveBeenCalledWith("toggleSidePanel", undefined)
  })

  it("places feedback after settings and opens a localized Featurebase URL with safe metadata", () => {
    window.history.replaceState({}, "", "/private/path?token=secret#section")
    renderFloatingButton()

    const settingsButton = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.settings",
    })
    const feedbackButton = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.feedback",
    })

    expect(
      settingsButton.compareDocumentPosition(feedbackButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(feedbackButton)

    const openPageCall = vi
      .mocked(sendMessage)
      .mock.calls.find(([message]) => message === "openPage")
    const openPagePayload = openPageCall?.[1] as { active: boolean; url: string } | undefined
    expect(openPagePayload).toBeDefined()
    const openedUrl = new URL(openPagePayload!.url)

    expect(openedUrl.origin).toBe("https://feedback.readfrog.app")
    expect(openedUrl.pathname).toBe("/en")
    expect(JSON.parse(openedUrl.searchParams.get("metaData")!)).toEqual({
      browser: "chrome",
      extension_version: "1.0.0",
      page_url: "http://localhost:3000/private/path",
    })
    expect(openPagePayload).toEqual({
      url: openedUrl.toString(),
      active: true,
    })
  })

  it("shows a Firefox sidebar help link when the browser requires an extension user action", async () => {
    vi.useFakeTimers()
    vi.mocked(sendMessage).mockResolvedValue({
      ok: false,
      reason: "requires-extension-user-action",
    })
    renderFloatingButton({ clickAction: "panel" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(toastAddMock).toHaveBeenCalledWith({
      id: "firefox-sidebar-user-action",
      positionerProps: {
        anchor: mainButton,
        side: "left",
        sideOffset: 8,
      },
      type: "info",
      title: expect.anything(),
    })

    const toastContent = toastAddMock.mock.calls[0]?.[0]?.title
    expect(toastContent).toBeDefined()
    render(<>{toastContent}</>)

    expect(screen.getByText("sidePanel.firefoxUserActionHint")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "sidePanel.firefoxUserActionHelpText" })
    expect(link).toHaveAttribute("href", "sidePanel.firefoxUserActionHelpUrl")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("places Firefox sidebar help to the right of a left-side floating button", async () => {
    vi.useFakeTimers()
    vi.mocked(sendMessage).mockResolvedValue({
      ok: false,
      reason: "requires-extension-user-action",
    })
    renderFloatingButton({ clickAction: "panel", side: "left" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 20,
      clientY: 500,
    })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 20,
      clientY: 500,
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        positionerProps: {
          anchor: mainButton,
          side: "right",
          sideOffset: 8,
        },
      }),
    )
  })

  it("keeps translate as a normal click action", () => {
    vi.useFakeTimers()
    renderFloatingButton({ clickAction: "translate" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })

    expect(sendMessage).toHaveBeenCalledWith(
      "tryToSetEnablePageTranslationOnContentScript",
      expect.objectContaining({ enabled: true }),
    )
  })

  it("turns the frog into the only visible control after a long press", () => {
    vi.useFakeTimers()
    renderFloatingButton()

    const mainButton = getMainButton()
    expect(screen.getAllByRole("button")).toHaveLength(5)

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(mainButton).toHaveClass("rounded-full")
    expect(screen.queryAllByRole("button")).toHaveLength(0)

    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("starts dragging before the long-press delay after enough pointer movement", () => {
    vi.useFakeTimers()
    renderFloatingButton()

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 500,
    })
    fireEvent.pointerMove(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 908,
      clientY: 500,
    })

    expect(mainButton).toHaveClass("rounded-full")
    expect(screen.queryAllByRole("button")).toHaveLength(0)

    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 908,
      clientY: 500,
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("persists the left side and vertical position after dragging to the left half", () => {
    vi.useFakeTimers()
    setViewport(1000, 1000)
    const { store } = renderFloatingButton({ position: 0.6, side: "right" })

    const mainButton = getMainButton()
    const floatingButtonContainer = screen.getByTestId("floating-button-container")
    mockRect(floatingButtonContainer, { left: 956, top: 600, width: 44, height: 120 })
    mockRect(mainButton, { left: 956, top: 640, width: 44, height: 40 })

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 978,
      clientY: 660,
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.pointerMove(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
      clientY: 520,
    })
    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
      clientY: 520,
    })

    expect(getFloatingButtonConfig(store).side).toBe("left")
    expect(getFloatingButtonConfig(store).position).toBeCloseTo(0.46)
  })

  it("persists the right side and vertical position after dragging to the right half", () => {
    vi.useFakeTimers()
    setViewport(1000, 1000)
    const { store } = renderFloatingButton({ position: 0.6, side: "left" })

    const mainButton = getMainButton()
    const floatingButtonContainer = screen.getByTestId("floating-button-container")
    mockRect(floatingButtonContainer, { left: 0, top: 600, width: 44, height: 120 })
    mockRect(mainButton, { left: 0, top: 640, width: 44, height: 40 })

    fireEvent.pointerDown(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 22,
      clientY: 660,
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.pointerMove(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 520,
    })
    fireEvent.pointerUp(mainButton, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 900,
      clientY: 520,
    })

    expect(getFloatingButtonConfig(store).side).toBe("right")
    expect(getFloatingButtonConfig(store).position).toBeCloseTo(0.46)
  })

  it("mirrors the controls when attached to the left edge", () => {
    renderFloatingButton({ side: "left" })

    const closeTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.floatingButtonOptions",
    })
    const lockTrigger = screen.getByRole("button", {
      name: "options.floatingButtonAndToolbar.floatingButton.tooltips.lockPosition",
    })
    const mainButton = getMainButton()
    const hiddenButtons = screen
      .getAllByRole("button")
      .filter((button) => button !== closeTrigger && button !== lockTrigger)

    expect(mainButton).toHaveClass("rounded-r-full")
    expect(mainButton).toHaveClass("-translate-x-6")
    expect(closeTrigger).toHaveClass("right-0")
    expect(lockTrigger).toHaveClass("right-0")
    for (const hiddenButton of hiddenButtons) {
      expect(hiddenButton).toHaveClass("-translate-x-12")
    }

    fireEvent.mouseEnter(mainButton)

    expect(mainButton).toHaveClass("translate-x-0")
    expect(closeTrigger).toHaveClass("-right-6")
    expect(lockTrigger).toHaveClass("-right-6")
    for (const hiddenButton of hiddenButtons) {
      expect(hiddenButton).toHaveClass("translate-x-0")
    }
  })
})
