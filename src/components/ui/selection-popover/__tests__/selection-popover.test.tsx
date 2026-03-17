// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createPortal } from "react-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SelectionPopover } from ".."

let latestRndProps: Record<string, any> | null = null
const updatePositionSpy = vi.fn()
const updateSizeSpy = vi.fn()
const onOpenChangeSpy = vi.fn()
let rafCallbacks = new Map<number, FrameRequestCallback>()
let nextRafId = 1
let mockRndOffset = { left: 0, top: 0 }
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
    const appliedDefaultRef = React.useRef(false)

    React.useImperativeHandle(ref, () => ({
      updatePosition: (position: { x: number, y: number }) => {
        updatePositionSpy(position)
        updateMockRect({
          left: position.x + mockRndOffset.left,
          top: position.y + mockRndOffset.top,
        })
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

      if (props.position) {
        updateMockRect({ left: props.position.x, top: props.position.y })
      }
      else if (!appliedDefaultRef.current && props.default) {
        appliedDefaultRef.current = true
        updateMockRect({
          left: props.default.x,
          top: props.default.y,
          width: typeof props.default.width === "number" ? props.default.width : undefined,
        })
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

function buildTriggerRect({
  left = 120,
  top = 140,
  width = 40,
  height = 32,
}: Partial<DOMRect> = {}) {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

function expectLatestPosition(position: { x: number, y: number }) {
  expect(latestRndProps?.position).toEqual(position)
  expect(mockRndRect.left).toBe(position.x)
  expect(mockRndRect.top).toBe(position.y)
}

function renderPopover({
  customTrigger = false,
  triggerLabel = "Open popover",
  title = "Test Popover",
  onOpenChange = onOpenChangeSpy,
  triggerRect = buildTriggerRect(),
} = {}) {
  render(
    <SelectionPopover.Root onOpenChange={onOpenChange}>
      <SelectionPopover.Trigger
        render={customTrigger ? <button data-testid="custom-trigger" className="custom-trigger" /> : undefined}
      >
        {triggerLabel}
      </SelectionPopover.Trigger>
      <SelectionPopover.Content>
        <SelectionPopover.Header className="border-b">
          <SelectionPopover.Title>{title}</SelectionPopover.Title>
          <div className="flex items-center gap-1">
            <SelectionPopover.Pin />
            <SelectionPopover.Close />
          </div>
        </SelectionPopover.Header>
        <SelectionPopover.Body>
          <div>Popover content</div>
        </SelectionPopover.Body>
      </SelectionPopover.Content>
    </SelectionPopover.Root>,
  )

  const trigger = screen.getByRole("button", { name: triggerLabel })
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(triggerRect)

  fireEvent.click(trigger)
  flushRaf()

  return {
    trigger,
    element: screen.getByTestId("mock-rnd"),
  }
}

function renderTwoPopovers() {
  const firstOnOpenChange = vi.fn()
  const secondOnOpenChange = vi.fn()

  render(
    <>
      <SelectionPopover.Root onOpenChange={firstOnOpenChange}>
        <SelectionPopover.Trigger>Open first popover</SelectionPopover.Trigger>
        <SelectionPopover.Content>
          <SelectionPopover.Header className="border-b">
            <SelectionPopover.Title>First Popover</SelectionPopover.Title>
            <div className="flex items-center gap-1">
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>
          <SelectionPopover.Body>
            <div>First content</div>
          </SelectionPopover.Body>
        </SelectionPopover.Content>
      </SelectionPopover.Root>

      <SelectionPopover.Root onOpenChange={secondOnOpenChange}>
        <SelectionPopover.Trigger>Open second popover</SelectionPopover.Trigger>
        <SelectionPopover.Content>
          <SelectionPopover.Header className="border-b">
            <SelectionPopover.Title>Second Popover</SelectionPopover.Title>
            <div className="flex items-center gap-1">
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>
          <SelectionPopover.Body>
            <div>Second content</div>
          </SelectionPopover.Body>
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </>,
  )

  const firstTrigger = screen.getByRole("button", { name: "Open first popover" })
  const secondTrigger = screen.getByRole("button", { name: "Open second popover" })

  vi.spyOn(firstTrigger, "getBoundingClientRect").mockReturnValue(buildTriggerRect({ left: 120, top: 140 }))
  vi.spyOn(secondTrigger, "getBoundingClientRect").mockReturnValue(buildTriggerRect({ left: 320, top: 240 }))

  return {
    firstOnOpenChange,
    secondOnOpenChange,
    firstTrigger,
    secondTrigger,
  }
}

function PortalledBoundary() {
  return createPortal(
    <div data-testid="portalled-boundary">
      Portalled boundary
    </div>,
    document.body,
  )
}

function ReopenablePopoverHarness() {
  const [open, setOpen] = React.useState(false)
  const [sourceSelection, setSourceSelection] = React.useState("First selection")
  const [snapshotSelection, setSnapshotSelection] = React.useState<string | null>(null)
  const [sessionKey, setSessionKey] = React.useState(0)

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setSnapshotSelection(sourceSelection)
      setSessionKey(prev => prev + 1)
      setOpen(true)
      return
    }

    setSnapshotSelection(null)
    setOpen(false)
  }, [sourceSelection])

  return (
    <div>
      <button type="button" onClick={() => setSourceSelection("Second selection")}>
        Switch selection
      </button>

      <SelectionPopover.Root open={open} onOpenChange={handleOpenChange}>
        <SelectionPopover.Trigger>Open popover</SelectionPopover.Trigger>
        <SelectionPopover.Content key={sessionKey}>
          <SelectionPopover.Header className="border-b">
            <SelectionPopover.Title>Session Popover</SelectionPopover.Title>
            <div className="flex items-center gap-1">
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>
          <SelectionPopover.Body>
            <div>{snapshotSelection ?? "empty"}</div>
          </SelectionPopover.Body>
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </div>
  )
}

describe("selectionPopover", () => {
  const originalResizeObserver = globalThis.ResizeObserver
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    latestRndProps = null
    onOpenChangeSpy.mockReset()
    rafCallbacks = new Map()
    nextRafId = 1
    mockRndOffset = { left: 0, top: 0 }
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
    expect(latestRndProps?.dragHandleClassName).toBe("rf-selection-popover-drag-handle")
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

  it("keeps the body shrinkable so overflow can scroll after viewport changes", () => {
    const { element } = renderPopover()

    expect(element).toHaveStyle({ display: "flex" })
    expect(screen.getByText("Test Popover").parentElement?.parentElement).toHaveClass("flex-1", "h-full", "min-h-0")
    expect(screen.getByText("Popover content").parentElement).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
  })

  it("renders the popover inside a fixed viewport host so page scroll does not move it", () => {
    const { element } = renderPopover()
    const viewportHost = element.parentElement

    expect(viewportHost).toHaveClass("fixed", "inset-0", "pointer-events-none")
    expectLatestPosition({ x: 120, y: 140 })

    updatePositionSpy.mockReset()

    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })

    expect(updatePositionSpy).not.toHaveBeenCalled()
    expectLatestPosition({ x: 120, y: 140 })
  })

  it("closes the popover when clicking outside", async () => {
    renderPopover()

    await act(async () => {
      await Promise.resolve()
    })

    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true })
    Object.defineProperty(mouseDownEvent, "composedPath", {
      value: () => [document.body, document, window],
    })
    const clickEvent = new MouseEvent("click", { bubbles: true })
    Object.defineProperty(clickEvent, "composedPath", {
      value: () => [document.body, document, window],
    })

    act(() => {
      document.body.dispatchEvent(mouseDownEvent)
      document.body.dispatchEvent(clickEvent)
    })

    expect(onOpenChangeSpy).toHaveBeenLastCalledWith(false)
    expect(screen.queryByTestId("mock-rnd")).not.toBeInTheDocument()
  })

  it("keeps a pinned popover open when clicking outside", async () => {
    renderPopover()

    fireEvent.click(screen.getByRole("button", { name: "Pin popover" }))

    await act(async () => {
      await Promise.resolve()
    })

    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true })
    Object.defineProperty(mouseDownEvent, "composedPath", {
      value: () => [document.body, document, window],
    })
    const clickEvent = new MouseEvent("click", { bubbles: true })
    Object.defineProperty(clickEvent, "composedPath", {
      value: () => [document.body, document, window],
    })

    act(() => {
      document.body.dispatchEvent(mouseDownEvent)
      document.body.dispatchEvent(clickEvent)
    })

    expect(screen.getByTestId("mock-rnd")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unpin popover" })).toHaveAttribute("aria-pressed", "true")
    expect(onOpenChangeSpy).not.toHaveBeenCalledWith(false)
  })

  it("keeps the popover open when clicking a registered portal boundary", () => {
    render(
      <SelectionPopover.Root onOpenChange={onOpenChangeSpy}>
        <SelectionPopover.Trigger>Open popover</SelectionPopover.Trigger>
        <SelectionPopover.Content>
          <SelectionPopover.Header className="border-b">
            <SelectionPopover.Title>Test Popover</SelectionPopover.Title>
            <div className="flex items-center gap-1">
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>
          <SelectionPopover.Body>
            <div>Popover content</div>
            <PortalledBoundary />
          </SelectionPopover.Body>
        </SelectionPopover.Content>
      </SelectionPopover.Root>,
    )

    const trigger = screen.getByRole("button", { name: "Open popover" })
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(buildTriggerRect())

    fireEvent.click(trigger)
    flushRaf()

    const boundary = screen.getByTestId("portalled-boundary")
    const event = new MouseEvent("mousedown", { bubbles: true })
    Object.defineProperty(event, "composedPath", {
      value: () => [boundary, document.body, document, window],
    })

    act(() => {
      document.dispatchEvent(event)
    })

    expect(screen.getByTestId("mock-rnd")).toBeInTheDocument()
    expect(onOpenChangeSpy).not.toHaveBeenCalledWith(false)
  })

  it("resets the pinned state after closing and reopening", () => {
    const { trigger } = renderPopover()

    fireEvent.click(screen.getByRole("button", { name: "Pin popover" }))
    expect(screen.getByRole("button", { name: "Unpin popover" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByTestId("mock-rnd")).not.toBeInTheDocument()

    fireEvent.click(trigger)
    flushRaf()

    expect(screen.getByRole("button", { name: "Pin popover" })).toHaveAttribute("aria-pressed", "false")
  })

  it("closes a pinned popover when another popover opens", () => {
    const { firstOnOpenChange, secondOnOpenChange, firstTrigger, secondTrigger } = renderTwoPopovers()

    fireEvent.click(firstTrigger)
    flushRaf()
    fireEvent.click(screen.getByRole("button", { name: "Pin popover" }))

    fireEvent.click(secondTrigger)
    flushRaf()

    expect(firstOnOpenChange).toHaveBeenCalledWith(false)
    expect(secondOnOpenChange).toHaveBeenLastCalledWith(true)
    expect(screen.queryByText("First content")).not.toBeInTheDocument()
    expect(screen.getByText("Second content")).toBeInTheDocument()
  })

  it("restarts the same popover session when clicking the same trigger again", () => {
    render(<ReopenablePopoverHarness />)

    const trigger = screen.getByRole("button", { name: "Open popover" })
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(buildTriggerRect())

    fireEvent.click(trigger)
    flushRaf()

    expect(screen.getByText("First selection")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Pin popover" }))
    expect(screen.getByRole("button", { name: "Unpin popover" })).toHaveAttribute("aria-pressed", "true")

    const firstElement = screen.getByTestId("mock-rnd")

    fireEvent.click(screen.getByRole("button", { name: "Switch selection" }))
    expect(screen.getByText("First selection")).toBeInTheDocument()

    fireEvent.click(trigger)
    flushRaf()

    expect(screen.getByText("Second selection")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pin popover" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByTestId("mock-rnd")).not.toBe(firstElement)
  })

  it("keeps growing downward until streamed content reaches the viewport bottom", async () => {
    const { element } = renderPopover()

    await act(async () => {
      await Promise.resolve()
    })

    mockRect(element, { left: 120, top: 500, width: 500, height: 280 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 500 })
    })
    flushRaf()

    updatePositionSpy.mockReset()

    mockRect(element, { left: 120, top: 500, width: 500, height: 320 })
    triggerResizeObserver()
    flushRaf()

    expect(updatePositionSpy).not.toHaveBeenCalled()
    expectLatestPosition({ x: 120, y: 500 })
  })

  it("grows upward once streamed content reaches the viewport bottom", async () => {
    const { element } = renderPopover()

    await act(async () => {
      await Promise.resolve()
    })

    mockRect(element, { left: 120, top: 500, width: 500, height: 280 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 500 })
    })
    flushRaf()

    updatePositionSpy.mockReset()

    mockRect(element, { left: 120, top: 500, width: 500, height: 420 })
    triggerResizeObserver()

    expectLatestPosition({ x: 120, y: 480 })
  })

  it("keeps a dragged popover bottom-anchored while streamed content keeps growing", async () => {
    const { element } = renderPopover()

    await act(async () => {
      await Promise.resolve()
    })

    mockRect(element, { left: 120, top: 620, width: 500, height: 280 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 620 })
    })
    flushRaf()

    updatePositionSpy.mockReset()

    mockRect(element, { left: 120, top: 620, width: 500, height: 360 })
    triggerResizeObserver()

    expectLatestPosition({ x: 120, y: 540 })
  })

  it("keeps dragging aligned to viewport coordinates when the rnd parent has a vertical offset", async () => {
    mockRndOffset = { left: 0, top: 80 }

    const { element } = renderPopover()

    await act(async () => {
      await Promise.resolve()
    })

    mockRect(element, { left: 120, top: 140, width: 500, height: 220 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 620 })
    })

    expectLatestPosition({ x: 120, y: 620 })
    expect(updatePositionSpy).not.toHaveBeenCalled()
  })

  it("reduces left and top space before shrinking a manually resized popover", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 100, top: 80, width: 680, height: 480 })

    act(() => {
      latestRndProps?.onResizeStop?.(
        new MouseEvent("mouseup"),
        "bottomRight",
        element,
        { width: 180, height: 180 },
        { x: 100, y: 80 },
      )
    })

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
    expectLatestPosition({ x: 20, y: 20 })
  })

  it("restores the remembered offset and size after the viewport grows again", () => {
    const { element } = renderPopover()
    mockRect(element, { left: 100, top: 80, width: 680, height: 480 })

    act(() => {
      latestRndProps?.onResizeStop?.(
        new MouseEvent("mouseup"),
        "bottomRight",
        element,
        { width: 180, height: 180 },
        { x: 100, y: 80 },
      )
    })

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
    expectLatestPosition({ x: 0, y: 0 })

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
    expectLatestPosition({ x: 100, y: 80 })
  })

  it("cancels stale auto-layout on drag start and reclamps once dragging stops", async () => {
    const { element } = renderPopover()

    await act(async () => {
      await Promise.resolve()
    })

    mockRect(element, { left: 120, top: 620, width: 500, height: 280 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 620 })
    })
    updatePositionSpy.mockReset()
    updateSizeSpy.mockReset()

    act(() => {
      latestRndProps?.onDragStart?.()
    })

    mockRect(element, { left: 120, top: 620, width: 500, height: 360 })
    triggerResizeObserver()

    expect(updatePositionSpy).not.toHaveBeenCalled()
    expect(updateSizeSpy).not.toHaveBeenCalled()
    expectLatestPosition({ x: 120, y: 620 })

    mockRect(element, { left: 120, top: 620, width: 500, height: 400 })
    triggerResizeObserver()

    expect(updatePositionSpy).not.toHaveBeenCalled()
    expect(updateSizeSpy).not.toHaveBeenCalled()
    expectLatestPosition({ x: 120, y: 620 })

    act(() => {
      latestRndProps?.onDragStop?.(new MouseEvent("mouseup"), { x: 120, y: 620 })
    })

    expectLatestPosition({ x: 120, y: 500 })
  })

  it("merges Base UI render props into a custom trigger element", () => {
    renderPopover({ customTrigger: true })

    const customTrigger = screen.getByTestId("custom-trigger")
    expect(customTrigger).toHaveClass("custom-trigger", "px-2", "h-7")
    expect(onOpenChangeSpy).toHaveBeenCalledWith(true)
  })
})
