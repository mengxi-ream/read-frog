// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { atom, useAtomValue } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE } from "@/entrypoints/selection.content/overlay-layers"
import { selectionSessionAtom } from "../atoms"
import { SelectionToolbar } from "../index"
import { MODAL_DIALOG_HOST_SLOT_ATTRIBUTE } from "../modal-dialog-host"

const MOCK_SELECTED_TEXT = "Selected Text"

function SelectionSessionProbe() {
  const session = useAtomValue(selectionSessionAtom)
  return <div data-testid="selection-session">{session?.selectionSnapshot.text ?? "empty"}</div>
}

// Mock child components
vi.mock("../translate-button", () => ({
  TranslateButton: () => null,
}))

vi.mock("../speak-button", () => ({
  SpeakButton: () => null,
}))

vi.mock("../custom-action-button", () => ({
  SelectionToolbarCustomActionButtons: () => null,
}))

// Mock atoms
vi.mock("@/utils/atoms/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/atoms/config")>()
  return {
    ...actual,
    configFieldsAtomMap: {
      ...actual.configFieldsAtomMap,
      selectionToolbar: atom({
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        opacity: 100,
        features: {
          translate: {
            enabled: true,
            providerId: "microsoft-translate-default",
            shortcut: "Alt+T",
          },
          speak: { enabled: true },
        },
        customActions: [],
      }),
    },
  }
})

describe("selectionToolbar - isInputOrTextarea logic", () => {
  let originalRequestAnimationFrame: typeof requestAnimationFrame
  let rafCallbacks: FrameRequestCallback[]
  let mockSelectionToString: () => string

  beforeEach(() => {
    // Mock requestAnimationFrame to execute callbacks synchronously
    rafCallbacks = []
    originalRequestAnimationFrame = window.requestAnimationFrame
    window.requestAnimationFrame = vi.fn<(...args: any[]) => any>(
      (callback: FrameRequestCallback) => {
        rafCallbacks.push(callback)
        return 0
      },
    )

    // Initialize mock selection text function
    mockSelectionToString = vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT)

    // Mock window.getSelection with dynamic text
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: mockSelectionToString,
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(() => true),
    }))
  })

  afterEach(() => {
    cleanup()
    window.requestAnimationFrame = originalRequestAnimationFrame
    rafCallbacks = []
    vi.clearAllMocks()
  })

  const setMockSelectionText = (text: string, containsNodeResult = true) => {
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => text),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(() => containsNodeResult),
    }))
  }

  const clearToolbarState = async () => {
    setMockSelectionText("")
    await act(async () => {
      document.dispatchEvent(new Event("selectionchange"))
    })
    setMockSelectionText(MOCK_SELECTED_TEXT)
  }

  const triggerMouseUpWithSelection = async (target: Element, clientX = 100, clientY = 100) => {
    const mouseUpEvent = new MouseEvent("mouseup", {
      bubbles: true,
      clientX,
      clientY,
    })

    Object.defineProperty(mouseUpEvent, "target", {
      value: target,
      writable: false,
    })

    await act(async () => {
      target.dispatchEvent(mouseUpEvent)
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((cb) => cb(0))
    })
  }

  const expectToolbarVisible = () => {
    expect(document.querySelector(".absolute.z-2147483647")).toHaveClass("opacity-100")
  }

  const expectToolbarHidden = () => {
    expect(document.querySelector(".absolute.z-2147483647")).toHaveClass("opacity-0")
  }

  const getToolbar = () => document.querySelector<HTMLElement>(".absolute.z-2147483647")

  const getToolbarSurface = () =>
    document.querySelector<HTMLElement>("[data-slot='selection-toolbar-surface']")

  it("applies configured opacity on the toolbar surface instead of the overlay host", () => {
    render(<SelectionToolbar />)

    expect(getToolbar()?.style.opacity).toBe("")
    expect(getToolbarSurface()?.style.opacity).toBe("var(--rf-selection-opacity, 1)")
  })

  it("should show toolbar when selecting text in a normal div element", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">{MOCK_SELECTED_TEXT}</div>
      </div>,
    )

    await triggerMouseUpWithSelection(screen.getByTestId("test-element"))
    await waitFor(() => expectToolbarVisible())
  })

  it("should show toolbar when selecting text in input and target equals activeElement", async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="test-element" type="text" defaultValue={MOCK_SELECTED_TEXT} />
      </div>,
    )

    const element = screen.getByTestId("test-element")
    const spy = vi.spyOn(document, "activeElement", "get").mockReturnValue(element)

    await triggerMouseUpWithSelection(element)
    await waitFor(() => expectToolbarVisible())

    spy.mockRestore()
  })

  it("should show toolbar when selecting text in textarea and target equals activeElement", async () => {
    render(
      <div>
        <SelectionToolbar />
        <textarea data-testid="test-element" defaultValue={MOCK_SELECTED_TEXT} />
      </div>,
    )

    const element = screen.getByTestId("test-element")
    const spy = vi.spyOn(document, "activeElement", "get").mockReturnValue(element)

    await triggerMouseUpWithSelection(element)
    await waitFor(() => expectToolbarVisible())

    spy.mockRestore()
  })

  it("should not show toolbar when input is activeElement but click target is outside", async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="input-element" type="text" />
        <div data-testid="outside-div">Outside content</div>
      </div>,
    )

    await clearToolbarState()

    const spy = vi
      .spyOn(document, "activeElement", "get")
      .mockReturnValue(screen.getByTestId("input-element"))

    await triggerMouseUpWithSelection(screen.getByTestId("outside-div"))
    expectToolbarHidden()

    spy.mockRestore()
  })

  it("should not show toolbar when textarea is activeElement but click target is outside", async () => {
    render(
      <div>
        <SelectionToolbar />
        <textarea data-testid="textarea-element" />
        <div data-testid="outside-div">Outside content</div>
      </div>,
    )

    await clearToolbarState()

    const spy = vi
      .spyOn(document, "activeElement", "get")
      .mockReturnValue(screen.getByTestId("textarea-element"))

    await triggerMouseUpWithSelection(screen.getByTestId("outside-div"))
    expectToolbarHidden()

    spy.mockRestore()
  })

  it("should not show toolbar when no text is selected", async () => {
    setMockSelectionText("")

    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Some text</div>
      </div>,
    )

    await act(async () => {
      document.dispatchEvent(new Event("selectionchange"))
    })

    await triggerMouseUpWithSelection(screen.getByTestId("test-element"))
    expectToolbarHidden()
  })

  it("should show toolbar when valid text is selected", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Some text</div>
      </div>,
    )

    await clearToolbarState()

    await triggerMouseUpWithSelection(screen.getByTestId("test-element"))
    await waitFor(() => expectToolbarVisible())
  })

  it("should keep the toolbar visible on right-click so context menu translation can reuse the selection", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">{MOCK_SELECTED_TEXT}</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    await triggerMouseUpWithSelection(target)
    await waitFor(() => expectToolbarVisible())

    await act(async () => {
      target.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 2,
          clientX: 100,
          clientY: 100,
        }),
      )
    })

    expectToolbarVisible()
  })

  it("should not show toolbar when selection does not contain the click target when click target is a button", async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="selected-element" type="text" defaultValue={MOCK_SELECTED_TEXT} />
        <button data-testid="click-element" type="button">
          Click target
        </button>
      </div>,
    )

    await clearToolbarState()

    // Mock selection that doesn't contain the click target
    const clickElement = screen.getByTestId("click-element")
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>((node: Node) => node !== clickElement),
    }))

    await triggerMouseUpWithSelection(clickElement)
    expectToolbarHidden()
  })

  it("should not show toolbar when selection does not contain the clicked button ancestor", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="selected-element">{MOCK_SELECTED_TEXT}</div>
        <button data-testid="click-button" type="button">
          <span data-testid="click-button-label">Click target</span>
        </button>
      </div>,
    )

    await clearToolbarState()

    const clickButton = screen.getByTestId("click-button")
    const clickTarget = screen.getByTestId("click-button-label")

    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>((node: Node) => node !== clickButton),
    }))

    await triggerMouseUpWithSelection(clickTarget)
    expectToolbarHidden()
  })

  it("should not show toolbar when shadow DOM retargets button clicks to the host element", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="selected-element">{MOCK_SELECTED_TEXT}</div>
      </div>,
    )

    await clearToolbarState()

    const shadowHost = document.createElement("read-frog-selection")
    const shadowButton = document.createElement("button")
    shadowButton.type = "button"
    let dispatchComplete = false

    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>((node: Node) => node !== shadowButton),
    }))

    const mouseUpEvent = new MouseEvent("mouseup", {
      bubbles: true,
      clientX: 100,
      clientY: 100,
      composed: true,
    })

    Object.defineProperty(mouseUpEvent, "target", {
      value: shadowHost,
      writable: false,
    })

    Object.defineProperty(mouseUpEvent, "composedPath", {
      value: () =>
        dispatchComplete ? [] : [shadowButton, shadowHost, document.body, document, window],
    })

    await act(async () => {
      document.dispatchEvent(mouseUpEvent)
      dispatchComplete = true
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((cb) => cb(0))
    })

    expectToolbarHidden()
  })

  it("should not show toolbar when selection boundaries are text nodes inside an overlay root", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="selected-element">{MOCK_SELECTED_TEXT}</div>
      </div>,
    )

    await clearToolbarState()

    const overlayRoot = document.createElement("div")
    overlayRoot.setAttribute(SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE, "")
    const overlayTextElement = document.createElement("span")
    overlayTextElement.textContent = MOCK_SELECTED_TEXT
    overlayRoot.appendChild(overlayTextElement)
    document.body.appendChild(overlayRoot)

    const textNode = overlayTextElement.firstChild
    if (!textNode) {
      throw new Error("Missing overlay text node")
    }

    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      anchorNode: textNode,
      focusNode: textNode,
      rangeCount: 1,
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: textNode,
        startOffset: 0,
        endContainer: textNode,
        endOffset: MOCK_SELECTED_TEXT.length,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(() => true),
    }))

    await triggerMouseUpWithSelection(overlayTextElement)
    expectToolbarHidden()
  })

  it("should show toolbar when selection contains the click target", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Selected and clicked text</div>
      </div>,
    )

    await clearToolbarState()

    const element = screen.getByTestId("test-element")
    // Mock selection that contains the click target
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(
        (node: Node) => node === element || element.contains(node),
      ),
    }))

    await triggerMouseUpWithSelection(element)
    await waitFor(() => expectToolbarVisible())
  })

  it("should show toolbar when selection contains the clicked button ancestor", async () => {
    render(
      <div>
        <SelectionToolbar />
        <button data-testid="click-button" type="button">
          <span data-testid="click-button-label">Selected button text</span>
        </button>
      </div>,
    )

    await clearToolbarState()

    const clickButton = screen.getByTestId("click-button")
    const clickTarget = screen.getByTestId("click-button-label")

    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(
        (node: Node) => node === clickButton || clickButton.contains(node),
      ),
    }))

    await triggerMouseUpWithSelection(clickTarget)
    await waitFor(() => expectToolbarVisible())
  })

  it("should show toolbar in input even when selection does not contain click target", async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="input-element" type="text" defaultValue={MOCK_SELECTED_TEXT} />
      </div>,
    )

    const element = screen.getByTestId("input-element")
    const spy = vi.spyOn(document, "activeElement", "get").mockReturnValue(element)

    // Mock selection that doesn't contain the click target
    // But this should still show toolbar because it's an input element
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(() => false),
    }))

    await triggerMouseUpWithSelection(element)
    await waitFor(() => expectToolbarVisible())

    spy.mockRestore()
  })

  it("keeps aria-hidden off the toolbar in both hidden and visible states", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">{MOCK_SELECTED_TEXT}</div>
      </div>,
    )

    const toolbar = document.querySelector<HTMLElement>(".absolute.z-2147483647")
    if (!toolbar) {
      throw new Error("Selection toolbar is missing")
    }

    expect(toolbar).not.toHaveAttribute("aria-hidden")

    await triggerMouseUpWithSelection(screen.getByTestId("test-element"))
    await waitFor(() => expectToolbarVisible())

    expect(toolbar).not.toHaveAttribute("aria-hidden")
  })
})

describe("selectionToolbar - positioning logic", () => {
  let originalRequestAnimationFrame: typeof requestAnimationFrame
  let rafCallbacks: FrameRequestCallback[]
  let selectionRects: DOMRect[]
  let rangeInvalid: boolean
  let getClientRectsDescriptor: PropertyDescriptor | undefined
  let getBoundingClientRectDescriptor: PropertyDescriptor | undefined
  let visualViewportDescriptor: PropertyDescriptor | undefined
  let resizeObserverDescriptor: PropertyDescriptor | undefined

  const createRect = ({
    left,
    top,
    width,
    height,
  }: {
    left: number
    top: number
    width: number
    height: number
  }) =>
    ({
      x: left,
      y: top,
      top,
      right: left + width,
      bottom: top + height,
      left,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect

  beforeEach(() => {
    // Mock requestAnimationFrame to execute callbacks synchronously
    rafCallbacks = []
    originalRequestAnimationFrame = window.requestAnimationFrame
    window.requestAnimationFrame = vi.fn<(...args: any[]) => any>(
      (callback: FrameRequestCallback) => {
        rafCallbacks.push(callback)
        return 0
      },
    )

    // Mock window.getSelection with valid selection
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: vi.fn<(...args: any[]) => any>(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn<(...args: any[]) => any>(() => true),
    }))

    selectionRects = [createRect({ left: 100, top: 100, width: 100, height: 20 })]
    rangeInvalid = false
    getClientRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects")
    getBoundingClientRectDescriptor = Object.getOwnPropertyDescriptor(
      Range.prototype,
      "getBoundingClientRect",
    )
    visualViewportDescriptor = Object.getOwnPropertyDescriptor(window, "visualViewport")
    resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver")
    Reflect.deleteProperty(window, "visualViewport")
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => {
        if (rangeInvalid) throw new Error("detached range")
        return selectionRects
      },
    })
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        if (rangeInvalid) throw new Error("detached range")
        return selectionRects[0] ?? createRect({ left: 0, top: 0, width: 0, height: 0 })
      },
    })

    // Mock window dimensions
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    })

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1200,
    })

    Object.defineProperty(window, "scrollX", {
      writable: true,
      configurable: true,
      value: 0,
    })

    Object.defineProperty(window, "scrollY", {
      writable: true,
      configurable: true,
      value: 0,
    })
  })

  afterEach(() => {
    cleanup()
    window.requestAnimationFrame = originalRequestAnimationFrame
    rafCallbacks = []
    if (getClientRectsDescriptor) {
      Object.defineProperty(Range.prototype, "getClientRects", getClientRectsDescriptor)
    } else {
      Reflect.deleteProperty(Range.prototype, "getClientRects")
    }
    if (getBoundingClientRectDescriptor) {
      Object.defineProperty(
        Range.prototype,
        "getBoundingClientRect",
        getBoundingClientRectDescriptor,
      )
    } else {
      Reflect.deleteProperty(Range.prototype, "getBoundingClientRect")
    }
    if (visualViewportDescriptor) {
      Object.defineProperty(window, "visualViewport", visualViewportDescriptor)
    } else {
      Reflect.deleteProperty(window, "visualViewport")
    }
    if (resizeObserverDescriptor) {
      Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, "ResizeObserver")
    }
    vi.clearAllMocks()
  })

  const triggerMouseDownAndUp = async (
    target: Element,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    selectionRects = [
      createRect({
        left: Math.min(startX, endX),
        top: Math.min(startY, endY),
        width: Math.max(Math.abs(endX - startX), 1),
        height: Math.max(Math.abs(endY - startY), 20),
      }),
    ]

    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      composed: true,
      clientX: startX,
      clientY: startY,
    })

    const mouseUpEvent = new MouseEvent("mouseup", {
      bubbles: true,
      composed: true,
      clientX: endX,
      clientY: endY,
    })

    Object.defineProperty(mouseDownEvent, "target", {
      value: target,
      writable: false,
    })

    Object.defineProperty(mouseUpEvent, "target", {
      value: target,
      writable: false,
    })

    await act(async () => {
      target.dispatchEvent(mouseDownEvent)
    })

    await act(async () => {
      target.dispatchEvent(mouseUpEvent)
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((cb) => cb(0))
    })
  }

  const getToolbarElement = () => {
    return document.querySelector(".absolute.z-2147483647") as HTMLElement
  }

  const mockToolbarDimensions = (toolbar: HTMLElement, width: number, height: number) => {
    Object.defineProperty(toolbar, "offsetWidth", {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(toolbar, "offsetHeight", {
      writable: true,
      configurable: true,
      value: height,
    })
  }

  it("should position toolbar at bottom-right when selecting from top-left to bottom-right", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Select from (100, 100) to (200, 200) - bottom-right direction
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For bottom-right, toolbar should be positioned at mouseUp coordinates (200, 200)
      // Accounting for scroll offset (0) and potential clamping
      const leftValue = Number.parseInt(toolbar.style.left, 10)
      const topValue = Number.parseInt(toolbar.style.top, 10)
      // Should be close to mouseUp position (200, 200) for bottom-right direction
      expect(leftValue).toBeGreaterThanOrEqual(175) // Allow some margin for clamping
      expect(leftValue).toBeLessThanOrEqual(225) // Allow some margin for clamping
      expect(topValue).toBeGreaterThanOrEqual(175) // Allow some margin for clamping
      expect(topValue).toBeLessThanOrEqual(225) // Allow some margin for clamping
    })
  })

  it("renders inside the highest fixed viewport layer", () => {
    render(<SelectionToolbar />)

    expect(getToolbarElement().parentElement).toHaveClass(
      "fixed",
      "inset-0",
      "pointer-events-none",
      "z-2147483647",
    )
  })

  it("moves its shadow host into a selected native modal before showing the toolbar", async () => {
    const extensionHost = document.createElement("read-frog-selection")
    const shadowRoot = extensionHost.attachShadow({ mode: "open" })
    const mount = document.createElement("div")
    shadowRoot.append(mount)
    document.body.append(extensionHost)

    const dialog = document.createElement("dialog")
    const selectedText = document.createTextNode("Selected inside modal")
    const target = document.createElement("p")
    target.append(selectedText)
    dialog.append(target)
    dialog.open = true
    document.body.append(dialog)
    const matches = dialog.matches.bind(dialog)
    const matchesSpy = vi
      .spyOn(dialog, "matches")
      .mockImplementation((selector) => (selector === ":modal" ? true : matches(selector)))
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: () => MOCK_SELECTED_TEXT,
      getRangeAt: () => ({
        startContainer: selectedText,
        startOffset: 0,
        endContainer: selectedText,
        endOffset: selectedText.length,
      }),
      containsNode: () => true,
    }))

    render(<SelectionToolbar />, { container: mount })
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    const slot = dialog.querySelector(`[${MODAL_DIALOG_HOST_SLOT_ATTRIBUTE}]`)
    expect(slot?.contains(extensionHost)).toBe(true)
    expect(shadowRoot.querySelector(".absolute.z-2147483647")).toHaveClass("opacity-100")
    matchesSpy.mockRestore()
  })

  it("should keep the bottom-right toolbar below the cursor to reduce accidental clicks", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")
    const toolbar = getToolbarElement()
    mockToolbarDimensions(toolbar, 200, 50)

    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const topValue = Number.parseInt(toolbar.style.top, 10)

      expect(topValue - 200).toBeGreaterThanOrEqual(20)
    })
  })

  it("should position toolbar at bottom-left when selecting from top-right to bottom-left", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Select from (200, 100) to (100, 200) - bottom-left direction
    await triggerMouseDownAndUp(target, 200, 100, 100, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For bottom-left, toolbar should be positioned at (endX - tooltipWidth, endY)
      // MouseUp is at (100, 200), so left should be less than 100 (minus tooltip width)
      const leftValue = Number.parseInt(toolbar.style.left, 10)
      const topValue = Number.parseInt(toolbar.style.top, 10)
      const toolbarWidth = toolbar.offsetWidth || 0
      // Left should be near endX - tooltipWidth, with direction offset margin
      expect(leftValue).toBeLessThanOrEqual(125) // Should be near mouseUp X position (offset by direction margin)
      expect(leftValue + toolbarWidth).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
      expect(topValue).toBeGreaterThanOrEqual(175) // Top should be near mouseUp Y (200)
      expect(topValue).toBeLessThanOrEqual(225) // Allow some margin
    })
  })

  it("should position toolbar at top-right when selecting from bottom-left to top-right", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Select from (100, 200) to (200, 100) - top-right direction
    await triggerMouseDownAndUp(target, 100, 200, 200, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For top-right, toolbar should be positioned at (endX, endY - tooltipHeight)
      // MouseUp is at (200, 100), so top should be less than 100 (minus tooltip height)
      const leftValue = Number.parseInt(toolbar.style.left, 10)
      const topValue = Number.parseInt(toolbar.style.top, 10)
      const toolbarHeight = toolbar.offsetHeight || 0
      // Left should be near mouseUp X position (200)
      expect(leftValue).toBeGreaterThanOrEqual(175) // Allow some margin for clamping
      expect(leftValue).toBeLessThanOrEqual(225) // Allow some margin
      // Top should be endY - tooltipHeight, clamped to boundaries
      expect(topValue).toBeLessThanOrEqual(100) // Should be above or at mouseUp Y position
      expect(topValue + toolbarHeight).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
    })
  })

  it("should position toolbar at top-left when selecting from bottom-right to top-left", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Select from (200, 200) to (100, 100) - top-left direction
    await triggerMouseDownAndUp(target, 200, 200, 100, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For top-left, toolbar should be positioned at (endX - tooltipWidth, endY - tooltipHeight)
      // MouseUp is at (100, 100), so both left and top should account for toolbar dimensions
      const leftValue = Number.parseInt(toolbar.style.left, 10)
      const topValue = Number.parseInt(toolbar.style.top, 10)
      const toolbarWidth = toolbar.offsetWidth || 0
      const toolbarHeight = toolbar.offsetHeight || 0
      // Left should be near mouseUp X (100) minus tooltip width, with direction offset margin
      expect(leftValue).toBeLessThanOrEqual(125) // Should be near mouseUp X position (offset by direction margin)
      expect(leftValue + toolbarWidth).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
      // Top should be less than mouseUp Y (100) minus tooltip height
      expect(topValue).toBeLessThanOrEqual(100) // Should be above or at mouseUp Y position
      expect(topValue + toolbarHeight).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
    })
  })

  it("should clamp toolbar position within left boundary", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Try to position toolbar at x=5 (less than MARGIN which is 10)
    await triggerMouseDownAndUp(target, 5, 100, 5, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // Should be clamped to at least MARGIN (10px)
      const leftValue = Number.parseInt(toolbar.style.left, 10)
      expect(leftValue).toBeGreaterThanOrEqual(10)
    })
  })

  it("should clamp toolbar position within top boundary", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Try to position toolbar at y=5 (less than MARGIN)
    await triggerMouseDownAndUp(target, 100, 5, 100, 5)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // Should be clamped to at least MARGIN (10px)
      const topValue = Number.parseInt(toolbar.style.top, 10)
      expect(topValue).toBeGreaterThanOrEqual(10)
    })
  })

  it("should clamp toolbar position within right boundary", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Try to position toolbar at x=1195 (close to clientWidth of 1200)
    await triggerMouseDownAndUp(target, 100, 100, 1195, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()

      // Mock toolbar dimensions for jsdom (no layout engine)
      // Using a realistic toolbar width of 200px
      const mockToolbarWidth = 200
      mockToolbarDimensions(toolbar, mockToolbarWidth, 50)

      // Trigger position update with mocked dimensions
      // Simulate what updatePosition does: rightBoundary = clientWidth - tooltipWidth - MARGIN = 1200 - 200 - 25 = 975
      // Since mouseUp is at x=1195, toolbar should be clamped to left <= 975
      // Manually trigger updatePosition by dispatching a scroll event
      act(() => {
        window.dispatchEvent(new Event("scroll"))
        const callbacks = [...rafCallbacks]
        rafCallbacks = []
        callbacks.forEach((cb) => cb(0))
      })
    })

    await waitFor(() => {
      const toolbar = getToolbarElement()
      const leftValue = Number.parseInt(toolbar.style.left, 10)
      const toolbarWidth = toolbar.offsetWidth
      // Should be clamped within right boundary
      // rightBoundary = clientWidth - tooltipWidth - MARGIN = 1200 - 200 - 25 = 975
      expect(leftValue).toBeLessThanOrEqual(975)
      expect(leftValue + toolbarWidth + 25).toBeLessThanOrEqual(1200) // left + width + margin <= clientWidth
    })
  })

  it("should clamp toolbar position within bottom boundary", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Try to position toolbar at y=795 (close to innerHeight of 800)
    await triggerMouseDownAndUp(target, 100, 100, 100, 795)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()

      // Mock toolbar dimensions for jsdom (no layout engine)
      // Using a realistic toolbar height of 50px
      const mockToolbarHeight = 50
      mockToolbarDimensions(toolbar, 200, mockToolbarHeight)

      // Trigger position update with mocked dimensions. The viewport bottom boundary is
      // 800 - 50 - 25 = 725, so a mouseup at y=795 must be clamped.
      // Manually trigger updatePosition by dispatching a scroll event
      act(() => {
        window.dispatchEvent(new Event("scroll"))
        const callbacks = [...rafCallbacks]
        rafCallbacks = []
        callbacks.forEach((cb) => cb(0))
      })
    })

    await waitFor(() => {
      const toolbar = getToolbarElement()
      const topValue = Number.parseInt(toolbar.style.top, 10)
      const toolbarHeight = toolbar.offsetHeight
      // Should be clamped within the visual viewport bottom boundary.
      expect(topValue).toBeLessThanOrEqual(725)
      expect(topValue + toolbarHeight + 25).toBeLessThanOrEqual(800) // top + height + margin <= innerHeight
    })
  })

  it("should update toolbar position on scroll", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
    })

    const toolbar = getToolbarElement()
    const initialTop = Number.parseInt(toolbar.style.top, 10)
    selectionRects = [createRect({ left: 100, top: 0, width: 100, height: 100 })]

    await act(async () => {
      window.dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((cb) => cb(0))
    })

    const updatedTop = Number.parseInt(toolbar.style.top, 10)
    expect(updatedTop).toBe(initialTop - 100)
  })

  it("should keep client coordinates independent from window scroll offsets", async () => {
    Object.defineProperty(window, "scrollY", {
      writable: true,
      configurable: true,
      value: 200,
    })

    Object.defineProperty(window, "scrollX", {
      writable: true,
      configurable: true,
      value: 50,
    })

    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    await triggerMouseDownAndUp(target, 100, 100, 100, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      const topValue = Number.parseInt(toolbar.style.top, 10)
      expect(topValue).toBe(120)
    })
  })

  it("should follow a selection when body is the scroll container", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    await triggerMouseDownAndUp(screen.getByTestId("test-element"), 100, 100, 200, 200)
    const toolbar = getToolbarElement()
    const initialTop = Number.parseInt(toolbar.style.top, 10)
    selectionRects = [createRect({ left: 100, top: 50, width: 100, height: 100 })]

    await act(async () => {
      document.body.dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(Number.parseInt(toolbar.style.top, 10)).toBe(initialTop - 50)
  })

  it("should follow a selection inside a nested scroll container", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="scroller">
          <div data-testid="test-element">Test content</div>
        </div>
      </div>,
    )

    await triggerMouseDownAndUp(screen.getByTestId("test-element"), 100, 100, 200, 200)
    const toolbar = getToolbarElement()
    const initialTop = Number.parseInt(toolbar.style.top, 10)
    selectionRects = [createRect({ left: 100, top: 25, width: 100, height: 100 })]

    await act(async () => {
      screen.getByTestId("scroller").dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(Number.parseInt(toolbar.style.top, 10)).toBe(initialTop - 75)
  })

  it("should follow a selection when a scroller lives inside shadow DOM", async () => {
    const shadowHost = document.createElement("div")
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    const target = document.createElement("span")
    const textNode = document.createTextNode("Shadow selection")
    target.append(textNode)
    shadowRoot.append(target)
    document.body.append(shadowHost)
    window.getSelection = vi.fn<(...args: any[]) => any>(() => ({
      toString: () => MOCK_SELECTED_TEXT,
      getRangeAt: () => ({
        startContainer: textNode,
        startOffset: 0,
        endContainer: textNode,
        endOffset: textNode.length,
      }),
      containsNode: () => true,
    }))

    render(<SelectionToolbar />)
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)
    const toolbar = getToolbarElement()
    const initialTop = Number.parseInt(toolbar.style.top, 10)
    selectionRects = [createRect({ left: 100, top: 20, width: 100, height: 100 })]

    await act(async () => {
      shadowRoot.dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(Number.parseInt(toolbar.style.top, 10)).toBe(initialTop - 80)
  })

  it("should close after the selection leaves the viewport and stay closed", async () => {
    render(
      <div>
        <SelectionToolbar />
        <SelectionSessionProbe />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    await triggerMouseDownAndUp(screen.getByTestId("test-element"), 100, 100, 200, 200)
    const toolbar = getToolbarElement()
    selectionRects = [createRect({ left: 100, top: -200, width: 100, height: 100 })]

    await act(async () => {
      document.body.dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(toolbar).toHaveClass("pointer-events-none", "opacity-0")
    expect(screen.getByTestId("selection-session")).toHaveTextContent(MOCK_SELECTED_TEXT)

    selectionRects = [createRect({ left: 100, top: 100, width: 100, height: 100 })]
    await act(async () => {
      document.body.dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(toolbar).toHaveClass("pointer-events-none", "opacity-0")
  })

  it("should clear a selection session when its range becomes invalid", async () => {
    render(
      <div>
        <SelectionToolbar />
        <SelectionSessionProbe />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    await triggerMouseDownAndUp(screen.getByTestId("test-element"), 100, 100, 200, 200)
    expect(screen.getByTestId("selection-session")).toHaveTextContent(MOCK_SELECTED_TEXT)
    rangeInvalid = true

    await act(async () => {
      document.body.dispatchEvent(new Event("scroll"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(getToolbarElement()).toHaveClass("pointer-events-none", "opacity-0")
    expect(screen.getByTestId("selection-session")).toHaveTextContent("empty")
  })

  it("should remeasure and clamp when the visual viewport is resized", async () => {
    const visualViewport = Object.assign(new EventTarget(), {
      offsetLeft: 0,
      offsetTop: 0,
      width: 1200,
      height: 800,
    })
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    })
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    await triggerMouseDownAndUp(screen.getByTestId("test-element"), 800, 500, 850, 570)
    const toolbar = getToolbarElement()
    mockToolbarDimensions(toolbar, 200, 50)
    visualViewport.width = 860
    visualViewport.height = 600

    await act(async () => {
      visualViewport.dispatchEvent(new Event("resize"))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(toolbar.style.left).toBe("635px")
    expect(toolbar.style.top).toBe("525px")
  })

  it("should re-clamp when ResizeObserver reports a toolbar size change", async () => {
    let resizeCallback: ResizeObserverCallback | null = null
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverMock,
    })
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    await triggerMouseDownAndUp(screen.getByTestId("test-element"), 900, 600, 1100, 700)
    const toolbar = getToolbarElement()
    mockToolbarDimensions(toolbar, 300, 100)

    await act(async () => {
      resizeCallback?.([], {} as ResizeObserver)
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((callback) => callback(0))
    })

    expect(toolbar.style.left).toBe("875px")
    expect(toolbar.style.top).toBe("675px")
  })

  it("should maintain toolbar visibility when window is resized", async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId("test-element")

    // Initial selection
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
    })

    // Resize window
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 600,
    })

    Object.defineProperty(document.documentElement, "clientWidth", {
      writable: true,
      configurable: true,
      value: 1000,
    })

    // Toolbar should still be visible and positioned
    const toolbar = getToolbarElement()
    expect(toolbar).toBeTruthy()
    expect(toolbar.style.left).toBeTruthy()
    expect(toolbar.style.top).toBeTruthy()
  })
})
