// @vitest-environment jsdom
import type { FloatingButtonConfig } from "@/types/config/floating-button"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { atom, createStore, Provider } from "jotai"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { sendMessage } from "@/utils/message"
import FloatingButton from ".."

const toastInfoMock = vi.fn()

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: (path = "") => `chrome-extension://test-extension${path}`,
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
    get => get(floatingButtonBaseAtom),
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
  sendMessage: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}))

beforeAll(() => {
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
  toastInfoMock.mockReset()
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

function renderFloatingButton(
  floatingButtonOverrides: Partial<FloatingButtonConfig> = {},
) {
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
  } as DOMRect)
}

describe("floatingButton controls", () => {
  it("shows the close trigger only after entering the main floating button", () => {
    renderFloatingButton()

    const closeTrigger = screen.getByRole("button", { name: "Close floating button" })
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

    const lockTrigger = screen.getByRole("button", { name: "Lock floating button" })
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

    const unlockTrigger = screen.getByRole("button", { name: "Unlock floating button" })

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

  it("forces the close trigger visible while the dropdown is open", () => {
    renderFloatingButton()

    const closeTrigger = screen.getByRole("button", { name: "Close floating button" })
    const mainButton = getMainButton()

    fireEvent.mouseEnter(mainButton)
    fireEvent.click(closeTrigger)

    expect(closeTrigger).toHaveClass("visible")
    expect(closeTrigger).toHaveClass("pointer-events-auto")
    expect(screen.getByText("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableForSite")).toBeInTheDocument()
  })

  it("toggles the browser side panel on a normal panel click", () => {
    vi.useFakeTimers()
    renderFloatingButton({ clickAction: "panel" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })

    expect(sendMessage).toHaveBeenCalledWith("toggleSidePanel", undefined)
  })

  it("shows a Firefox sidebar help link when the browser requires an extension user action", async () => {
    vi.useFakeTimers()
    vi.mocked(sendMessage).mockResolvedValue({
      ok: false,
      reason: "requires-extension-user-action",
    })
    renderFloatingButton({ clickAction: "panel" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })

    await act(async () => {
      await Promise.resolve()
    })

    const toastContent = toastInfoMock.mock.calls[0]?.[0]
    expect(toastContent).toBeDefined()
    render(<>{toastContent}</>)

    expect(screen.getByText("sidePanel.firefoxUserActionHint")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "sidePanel.firefoxUserActionHelpText" })
    expect(link).toHaveAttribute(
      "href",
      "sidePanel.firefoxUserActionHelpUrl",
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("keeps translate as a normal click action", () => {
    vi.useFakeTimers()
    renderFloatingButton({ clickAction: "translate" })

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })
    vi.advanceTimersByTime(349)
    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })

    expect(sendMessage).toHaveBeenCalledWith(
      "tryToSetEnablePageTranslationOnContentScript",
      expect.objectContaining({ enabled: true }),
    )
  })

  it("turns the frog into the only visible control after a long press", () => {
    vi.useFakeTimers()
    renderFloatingButton()

    const mainButton = getMainButton()
    expect(screen.getAllByRole("button")).toHaveLength(4)

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(mainButton).toHaveClass("rounded-full")
    expect(screen.queryAllByRole("button")).toHaveLength(0)

    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("starts dragging before the long-press delay after enough pointer movement", () => {
    vi.useFakeTimers()
    renderFloatingButton()

    const mainButton = getMainButton()

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 500 })
    fireEvent.pointerMove(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 908, clientY: 500 })

    expect(mainButton).toHaveClass("rounded-full")
    expect(screen.queryAllByRole("button")).toHaveLength(0)

    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 908, clientY: 500 })
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

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 978, clientY: 660 })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.pointerMove(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 120, clientY: 520 })
    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 120, clientY: 520 })

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

    fireEvent.pointerDown(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 22, clientY: 660 })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.pointerMove(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 520 })
    fireEvent.pointerUp(mainButton, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 900, clientY: 520 })

    expect(getFloatingButtonConfig(store).side).toBe("right")
    expect(getFloatingButtonConfig(store).position).toBeCloseTo(0.46)
  })

  it("mirrors the controls when attached to the left edge", () => {
    renderFloatingButton({ side: "left" })

    const closeTrigger = screen.getByRole("button", { name: "Close floating button" })
    const lockTrigger = screen.getByRole("button", { name: "Lock floating button" })
    const mainButton = getMainButton()
    const hiddenButtons = screen.getAllByRole("button").filter(button => (
      button !== closeTrigger && button !== lockTrigger
    ))

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
