// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider, useAtomValue } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  isSelectionToolbarVisibleAtom,
  isTranslatePopoverVisibleAtom,
  mouseClickPositionAtom,
  selectionContentAtom,
} from "../../atom"
import { TranslateButton } from "../../translate-button"
import { PopoverWrapper } from "../popover-wrapper"

let latestRndProps: Record<string, any> | null = null
const updatePositionSpy = vi.fn()
const updateSizeSpy = vi.fn()
let rafCallbacks = new Map<number, FrameRequestCallback>()
let nextRafId = 1
let mockRndRect = {
  x: 120,
  y: 140,
  left: 120,
  top: 140,
  right: 620,
  bottom: 360,
  width: 500,
  height: 220,
}

function updateMockRect(rect: Partial<DOMRect>) {
  const left = rect.left ?? rect.x ?? mockRndRect.left
  const top = rect.top ?? rect.y ?? mockRndRect.top
  const width = rect.width ?? mockRndRect.width
  const height = rect.height ?? mockRndRect.height

  mockRndRect = {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  }
}

function flushRaf() {
  act(() => {
    const callbacks = [...rafCallbacks.values()]
    rafCallbacks.clear()
    callbacks.forEach(callback => callback(0))
  })
}

vi.mock("react-rnd", async () => {
  const React = await import("react")

  function MockRnd({ ref, ...props }: any) {
    latestRndProps = props
    const elementRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => ({
      updatePosition: (position: { x: number, y: number }) => {
        updatePositionSpy(position)
        updateMockRect({ left: position.x, top: position.y })
      },
      updateSize: (size: { width: number, height: number }) => {
        updateSizeSpy(size)
        updateMockRect({ width: size.width, height: size.height })
      },
      getSelfElement: () => elementRef.current,
    }), [])

    React.useLayoutEffect(() => {
      if (!elementRef.current) {
        return
      }

      Object.defineProperty(elementRef.current, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          ...mockRndRect,
          toJSON: () => ({}),
        }),
      })
      Object.defineProperty(elementRef.current, "offsetWidth", {
        configurable: true,
        get: () => mockRndRect.width,
      })
      Object.defineProperty(elementRef.current, "offsetHeight", {
        configurable: true,
        get: () => mockRndRect.height,
      })
    })

    return (
      <div
        ref={elementRef}
        data-testid="mock-rnd"
        className={props.className}
        style={{
          width: "auto",
          height: "auto",
          display: "inline-block",
          position: "absolute",
          top: 0,
          left: 0,
          ...props.style,
        }}
        onWheel={props.onWheel}
      >
        {props.children}
      </div>
    )
  }

  MockRnd.displayName = "MockRnd"

  return { Rnd: MockRnd }
})

let resizeObservers: MockResizeObserver[] = []

class MockResizeObserver {
  callback: ResizeObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObservers.push(this)
  }
}

function triggerResizeObserver() {
  act(() => {
    resizeObservers.forEach(observer => observer.callback([], observer as unknown as ResizeObserver))
  })
}

function AtomSnapshot() {
  const isToolbarVisible = useAtomValue(isSelectionToolbarVisibleAtom)
  const isTranslatePopoverVisible = useAtomValue(isTranslatePopoverVisibleAtom)
  const mousePosition = useAtomValue(mouseClickPositionAtom)

  return (
    <div>
      <span data-testid="toolbar-visible">{String(isToolbarVisible)}</span>
      <span data-testid="translate-visible">{String(isTranslatePopoverVisible)}</span>
      <span data-testid="mouse-position">{mousePosition ? `${mousePosition.x},${mousePosition.y}` : "null"}</span>
    </div>
  )
}

function renderPopover() {
  const store = createStore()
  store.set(selectionContentAtom, "Selected text")
  store.set(mouseClickPositionAtom, { x: 120, y: 140 })
  const setIsVisible = vi.fn()
  const onClose = vi.fn()

  render(
    <Provider store={store}>
      <PopoverWrapper
        title="Test Popover"
        icon="tabler:star"
        isVisible
        setIsVisible={setIsVisible}
        onClose={onClose}
      >
        <div>Popover content</div>
      </PopoverWrapper>
    </Provider>,
  )

  flushRaf()

  return {
    element: screen.getByTestId("mock-rnd"),
    onClose,
    setIsVisible,
  }
}

function mockRect(element: HTMLElement, rect: Partial<DOMRect>) {
  updateMockRect(rect)
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      ...mockRndRect,
      toJSON: () => ({}),
    }),
  })
  Object.defineProperty(element, "offsetWidth", {
    configurable: true,
    get: () => mockRndRect.width,
  })
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => mockRndRect.height,
  })
}

describe("popoverWrapper", () => {
  const originalResizeObserver = globalThis.ResizeObserver
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    latestRndProps = null
    rafCallbacks = new Map()
    nextRafId = 1
    resizeObservers = []
    updateMockRect({
      left: 120,
      top: 140,
      width: 500,
      height: 220,
    })
    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextRafId++
      rafCallbacks.set(id, callback)
      return id
    })
    window.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks.delete(id)
    })

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 900,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.ResizeObserver = originalResizeObserver
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
    })
  })

  it("configures react-rnd with drag handle and eight resize directions", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 120, top: 140, width: 500, height: 220 })

    expect(screen.getByText("Test Popover")).toBeInTheDocument()
    expect(latestRndProps?.dragHandleClassName).toBe("rf-selection-toolbar-popover-drag-handle")
    expect(latestRndProps?.enableResizing).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
      topRight: true,
      bottomRight: true,
      bottomLeft: true,
      topLeft: true,
    })
  })

  it("keeps the popover content area shrinkable so overflow can scroll after viewport changes", () => {
    const { element } = renderPopover()

    expect(element).toHaveStyle({ display: "flex" })
    expect(screen.getByText("Popover content").parentElement).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
  })

  it("closes the popover when clicking outside", () => {
    const { onClose, setIsVisible } = renderPopover()

    const event = new MouseEvent("mousedown", { bubbles: true })
    Object.defineProperty(event, "composedPath", {
      value: () => [document.body, document, window],
    })

    document.dispatchEvent(event)

    expect(setIsVisible).toHaveBeenCalledWith(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("reduces left and top space before shrinking a manually resized popover", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 100, top: 80, width: 680, height: 480 })

    latestRndProps?.onResizeStop?.(
      new MouseEvent("mouseup"),
      "bottomRight",
      element,
      { width: 180, height: 180 },
      { x: 100, y: 80 },
    )

    flushRaf()

    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 700,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 500,
    })

    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    flushRaf()

    expect(updateSizeSpy).not.toHaveBeenCalled()
    expect(updatePositionSpy).toHaveBeenCalledWith({ x: 20, y: 20 })
  })

  it("restores the remembered offset and size after the viewport grows again", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 100, top: 80, width: 680, height: 480 })

    latestRndProps?.onResizeStop?.(
      new MouseEvent("mouseup"),
      "bottomRight",
      element,
      { width: 180, height: 180 },
      { x: 100, y: 80 },
    )

    flushRaf()

    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 600,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 400,
    })

    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    flushRaf()

    expect(updateSizeSpy).toHaveBeenCalledWith({ width: 600, height: 400 })
    expect(updatePositionSpy).toHaveBeenCalledWith({ x: 0, y: 0 })

    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()
    mockRect(element, { left: 0, top: 0, width: 600, height: 400 })

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 900,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 700,
    })

    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    flushRaf()

    expect(updateSizeSpy).toHaveBeenCalledWith({ width: 680, height: 480 })
    expect(updatePositionSpy).toHaveBeenCalledWith({ x: 100, y: 80 })
  })

  it("cancels stale auto-layout on drag start and reclamps when drag height grows past the viewport", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 120, top: 620, width: 500, height: 280 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 620 })
    })
    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()

    mockRect(element, { left: 120, top: 620, width: 500, height: 360 })
    triggerResizeObserver()

    act(() => {
      latestRndProps?.onDragStart?.()
    })
    flushRaf()

    expect(updatePositionSpy).not.toHaveBeenCalled()
    expect(updateSizeSpy).not.toHaveBeenCalled()

    mockRect(element, { left: 120, top: 620, width: 500, height: 400 })
    triggerResizeObserver()
    flushRaf()

    expect(updatePositionSpy).toHaveBeenCalledWith({ x: 120, y: 500 })
    expect(updateSizeSpy).not.toHaveBeenCalled()
  })

  it("reclamps drag movement using the current grown height before mouseup", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 120, top: 500, width: 500, height: 400 })

    act(() => {
      latestRndProps?.onDragStart?.()
      latestRndProps?.onDrag?.(new MouseEvent("mousemove"), {
        x: 120,
        y: 620,
        deltaX: 0,
        deltaY: 120,
        lastX: 120,
        lastY: 500,
        node: element,
      })
    })

    expect(updatePositionSpy).toHaveBeenCalledWith({ x: 120, y: 500 })
    expect(updateSizeSpy).not.toHaveBeenCalled()
  })

  it("uses the dropped position as the new growth anchor after dragging to a lower free area", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 120, top: 620, width: 500, height: 360 })

    act(() => {
      latestRndProps?.onDragStart?.()
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 400 })
    })
    flushRaf()

    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()

    mockRect(element, { left: 120, top: 400, width: 500, height: 420 })
    triggerResizeObserver()
    flushRaf()

    expect(updatePositionSpy).not.toHaveBeenCalled()
    expect(updateSizeSpy).not.toHaveBeenCalled()
  })
})

describe("translateButton", () => {
  it("hides the toolbar and opens the translate popover state on click", () => {
    const store = createStore()
    store.set(isSelectionToolbarVisibleAtom, true)

    render(
      <Provider store={store}>
        <TranslateButton />
        <AtomSnapshot />
      </Provider>,
    )

    const button = screen.getByRole("button")
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      x: 140,
      y: 90,
      left: 140,
      top: 90,
      right: 180,
      bottom: 120,
      width: 40,
      height: 30,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(button)

    expect(screen.getByTestId("toolbar-visible")).toHaveTextContent("false")
    expect(screen.getByTestId("translate-visible")).toHaveTextContent("true")
    expect(screen.getByTestId("mouse-position")).toHaveTextContent("140,90")
  })
})
