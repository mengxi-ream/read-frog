// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { enablePageTranslationAtom, isDraggingButtonAtom, isSideOpenAtom } from "../../../atoms"
import FloatingButton from "../index"

const {
  atomRefs,
  createFeatureUsageContextMock,
  sendMessageMock,
} = vi.hoisted(() => ({
  atomRefs: {
    floatingButtonBaseAtom: undefined as any,
    sideContentBaseAtom: undefined as any,
  },
  createFeatureUsageContextMock: vi.fn(() => ({
    feature: "page_translation",
    surface: "floating_button",
    startedAt: 123,
  })),
  sendMessageMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getManifest: () => ({ version: "1.0.0" }),
      getURL: (path: string) => `chrome-extension://read-frog${path}`,
    },
  },
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: createFeatureUsageContextMock,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("../../../atoms", async () => {
  const { atom } = await import("jotai")

  const mockedEnablePageTranslationAtom = atom({ enabled: false })
  const mockedIsDraggingButtonAtom = atom(false)
  const mockedIsSideOpenAtom = atom(false)

  return {
    enablePageTranslationAtom: mockedEnablePageTranslationAtom,
    isDraggingButtonAtom: mockedIsDraggingButtonAtom,
    isSideOpenAtom: mockedIsSideOpenAtom,
  }
})

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")

  atomRefs.floatingButtonBaseAtom = atom({
    enabled: true,
    position: 0.5,
    disabledFloatingButtonPatterns: [],
    clickAction: "translate",
  })

  const floatingButtonAtom = atom(
    get => get(atomRefs.floatingButtonBaseAtom),
    (get, set, patch: Record<string, unknown>) => {
      const currentValue = get(atomRefs.floatingButtonBaseAtom) as Record<string, unknown>

      set(atomRefs.floatingButtonBaseAtom, {
        ...currentValue,
        ...patch,
      })
    },
  )

  atomRefs.sideContentBaseAtom = atom({ width: 320 })
  const sideContentAtom = atom(get => get(atomRefs.sideContentBaseAtom))

  return {
    configFieldsAtomMap: {
      floatingButton: floatingButtonAtom,
      sideContent: sideContentAtom,
    },
  }
})

vi.mock("../../../index", () => ({
  shadowWrapper: document.body,
}))

vi.mock("@/components/ui/base-ui/dropdown-menu", async () => {
  const React = await import("react")

  const MenuContext = React.createContext<{
    open: boolean
    onOpenChange?: (open: boolean) => void
  }>({
    open: false,
  })

  return {
    DropdownMenu: ({
      open = false,
      onOpenChange,
      children,
    }: any) => (
      <MenuContext value={{ open, onOpenChange }}>
        {children}
      </MenuContext>
    ),
    DropdownMenuTrigger: ({
      render,
      children,
    }: any) => {
      const { open, onOpenChange } = React.use(MenuContext)

      return React.cloneElement(render, {
        onClick: (event: any) => {
          render.props.onClick?.(event)
          onOpenChange?.(!open)
        },
        onPointerDown: (event: any) => {
          render.props.onPointerDown?.(event)
        },
      }, children)
    },
    DropdownMenuContent: ({
      children,
    }: any) => {
      const { open } = React.use(MenuContext)
      return open ? <div>{children}</div> : null
    },
    DropdownMenuItem: ({
      children,
      onClick,
      onPointerDown,
    }: any) => (
      <button type="button" onClick={onClick} onPointerDown={onPointerDown}>
        {children}
      </button>
    ),
  }
})

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

function createMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === "(pointer: coarse)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function renderFloatingButton(options?: {
  clickAction?: "panel" | "translate"
  translationEnabled?: boolean
}) {
  const store = createStore()

  store.set(atomRefs.floatingButtonBaseAtom, {
    enabled: true,
    position: 0.5,
    disabledFloatingButtonPatterns: [],
    clickAction: options?.clickAction ?? "translate",
  })
  store.set(atomRefs.sideContentBaseAtom, { width: 320 })
  store.set(enablePageTranslationAtom, { enabled: options?.translationEnabled ?? false })
  store.set(isDraggingButtonAtom, false)
  store.set(isSideOpenAtom, false)

  render(
    <Provider store={store}>
      <FloatingButton />
    </Provider>,
  )

  const mainBall = screen.getByAltText("Read Frog").parentElement
  if (!mainBall) {
    throw new Error("Floating button main ball not found")
  }

  return { store, mainBall }
}

describe("floating button interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMatchMedia(false),
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 1000,
    })
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    })

    sendMessageMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("updates the stored position on pointer drag without triggering the primary click action", async () => {
    const { store, mainBall } = renderFloatingButton({
      clickAction: "translate",
      translationEnabled: false,
    })

    await act(async () => {
      fireEvent.pointerDown(mainBall, {
        button: 0,
        clientX: 20,
        clientY: 200,
        pointerId: 1,
        pointerType: "touch",
      })
      fireEvent.pointerMove(mainBall, {
        clientX: 20,
        clientY: 280,
        pointerId: 1,
        pointerType: "touch",
      })
      fireEvent.pointerUp(mainBall, {
        clientX: 20,
        clientY: 280,
        pointerId: 1,
        pointerType: "touch",
      })
    })

    expect(sendMessageMock).not.toHaveBeenCalled()
    await waitFor(() => {
      const floatingButtonState = store.get(atomRefs.floatingButtonBaseAtom) as { position: number }
      expect(floatingButtonState.position).not.toBe(0.5)
    })
  })

  it("opens the menu on touch long press without triggering translation or panel actions", async () => {
    vi.useFakeTimers()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: createMatchMedia(true),
    })

    const { store, mainBall } = renderFloatingButton({
      clickAction: "panel",
      translationEnabled: false,
    })

    await act(async () => {
      fireEvent.pointerDown(mainBall, {
        button: 0,
        clientX: 24,
        clientY: 220,
        pointerId: 2,
        pointerType: "touch",
      })
      vi.advanceTimersByTime(450)
    })

    expect(
      screen.getByText("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableForSite"),
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.pointerUp(mainBall, {
        clientX: 24,
        clientY: 220,
        pointerId: 2,
        pointerType: "touch",
      })
    })

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(store.get(isSideOpenAtom)).toBe(false)
  })

  it("sends only one translate toggle request while a previous toggle is still pending", async () => {
    const toggleDeferred = createDeferred<void>()
    sendMessageMock.mockImplementation(() => toggleDeferred.promise)

    const { mainBall } = renderFloatingButton({
      clickAction: "translate",
      translationEnabled: false,
    })

    await act(async () => {
      fireEvent.pointerDown(mainBall, {
        button: 0,
        clientX: 30,
        clientY: 240,
        pointerId: 3,
        pointerType: "mouse",
      })
      fireEvent.pointerUp(mainBall, {
        clientX: 30,
        clientY: 240,
        pointerId: 3,
        pointerType: "mouse",
      })
      fireEvent.pointerDown(mainBall, {
        button: 0,
        clientX: 30,
        clientY: 240,
        pointerId: 4,
        pointerType: "mouse",
      })
      fireEvent.pointerUp(mainBall, {
        clientX: 30,
        clientY: 240,
        pointerId: 4,
        pointerType: "mouse",
      })
    })

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      "tryToSetEnablePageTranslationOnContentScript",
      {
        enabled: true,
        analyticsContext: {
          feature: "page_translation",
          surface: "floating_button",
          startedAt: 123,
        },
      },
    )

    toggleDeferred.resolve()
    await act(async () => {
      await toggleDeferred.promise
    })
  })
})
