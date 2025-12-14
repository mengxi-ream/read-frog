// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionToolbar } from '../index'

const MOCK_SELECTED_TEXT = 'Selected Text'

// Mock child components
vi.mock('../ai-button', () => ({
  AiButton: () => null,
  AiPopover: () => null,
}))

vi.mock('../translate-button', () => ({
  TranslateButton: () => null,
  TranslatePopover: () => null,
}))

vi.mock('../speak-button', () => ({
  SpeakButton: () => null,
}))

// Mock atoms
vi.mock('@/utils/atoms/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/atoms/config')>()
  return {
    ...actual,
    configFieldsAtomMap: {
      ...actual.configFieldsAtomMap,
      selectionToolbar: atom({ enabled: true }),
    },
  }
})

describe('selectionToolbar - isInputOrTextarea logic', () => {
  let originalRequestAnimationFrame: typeof requestAnimationFrame
  let rafCallbacks: FrameRequestCallback[]
  let mockSelectionToString: () => string

  beforeEach(() => {
    // Mock requestAnimationFrame to execute callbacks synchronously
    rafCallbacks = []
    originalRequestAnimationFrame = window.requestAnimationFrame
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return 0
    })

    // Initialize mock selection text function
    mockSelectionToString = vi.fn(() => MOCK_SELECTED_TEXT)

    // Mock window.getSelection with dynamic text
    window.getSelection = vi.fn(() => ({
      toString: mockSelectionToString,
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn(() => true),
    })) as unknown as typeof window.getSelection
  })

  afterEach(() => {
    cleanup()
    window.requestAnimationFrame = originalRequestAnimationFrame
    rafCallbacks = []
    vi.clearAllMocks()
  })

  const setMockSelectionText = (text: string, containsNodeResult = true) => {
    window.getSelection = vi.fn(() => ({
      toString: vi.fn(() => text),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn(() => containsNodeResult),
    })) as unknown as typeof window.getSelection
  }

  const clearToolbarState = async () => {
    setMockSelectionText('')
    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    setMockSelectionText(MOCK_SELECTED_TEXT)
  }

  const triggerMouseUpWithSelection = async (
    target: Element,
    clientX = 100,
    clientY = 100,
  ) => {
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      clientX,
      clientY,
    })

    Object.defineProperty(mouseUpEvent, 'target', {
      value: target,
      writable: false,
    })

    await act(async () => {
      target.dispatchEvent(mouseUpEvent)
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach(cb => cb(0))
    })
  }

  const expectToolbarVisible = () => {
    expect(document.querySelector('.absolute.z-2147483647')).toBeTruthy()
  }

  const expectToolbarHidden = () => {
    expect(document.querySelector('.absolute.z-2147483647')).toBeFalsy()
  }

  it('should show toolbar when selecting text in a normal div element', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">{MOCK_SELECTED_TEXT}</div>
      </div>,
    )

    await triggerMouseUpWithSelection(screen.getByTestId('test-element'))
    await waitFor(expectToolbarVisible)
  })

  it('should show toolbar when selecting text in input and target equals activeElement', async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="test-element" type="text" defaultValue={MOCK_SELECTED_TEXT} />
      </div>,
    )

    const element = screen.getByTestId('test-element')
    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(element)

    await triggerMouseUpWithSelection(element)
    await waitFor(expectToolbarVisible)

    spy.mockRestore()
  })

  it('should show toolbar when selecting text in textarea and target equals activeElement', async () => {
    render(
      <div>
        <SelectionToolbar />
        <textarea data-testid="test-element" defaultValue={MOCK_SELECTED_TEXT} />
      </div>,
    )

    const element = screen.getByTestId('test-element')
    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(element)

    await triggerMouseUpWithSelection(element)
    await waitFor(expectToolbarVisible)

    spy.mockRestore()
  })

  it('should not show toolbar when input is activeElement but click target is outside', async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="input-element" type="text" />
        <div data-testid="outside-div">Outside content</div>
      </div>,
    )

    await clearToolbarState()

    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(
      screen.getByTestId('input-element'),
    )

    await triggerMouseUpWithSelection(screen.getByTestId('outside-div'))
    expectToolbarHidden()

    spy.mockRestore()
  })

  it('should not show toolbar when textarea is activeElement but click target is outside', async () => {
    render(
      <div>
        <SelectionToolbar />
        <textarea data-testid="textarea-element" />
        <div data-testid="outside-div">Outside content</div>
      </div>,
    )

    await clearToolbarState()

    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(
      screen.getByTestId('textarea-element'),
    )

    await triggerMouseUpWithSelection(screen.getByTestId('outside-div'))
    expectToolbarHidden()

    spy.mockRestore()
  })

  it('should not show toolbar when no text is selected', async () => {
    setMockSelectionText('')

    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Some text</div>
      </div>,
    )

    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'))
    })

    await triggerMouseUpWithSelection(screen.getByTestId('test-element'))
    expectToolbarHidden()
  })

  it('should show toolbar when valid text is selected', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Some text</div>
      </div>,
    )

    await clearToolbarState()

    await triggerMouseUpWithSelection(screen.getByTestId('test-element'))
    await waitFor(expectToolbarVisible)
  })

  it('should not show toolbar when selection does not contain the click target when click target is a button', async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="selected-element" type="text" defaultValue={MOCK_SELECTED_TEXT} />
        <button data-testid="click-element" type="button">Click target</button>
      </div>,
    )

    await clearToolbarState()

    // Mock selection that doesn't contain the click target
    const clickElement = screen.getByTestId('click-element')
    window.getSelection = vi.fn(() => ({
      toString: vi.fn(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn((node: Node) => node !== clickElement),
    })) as unknown as typeof window.getSelection

    await triggerMouseUpWithSelection(clickElement)
    expectToolbarHidden()
  })

  it('should show toolbar when selection contains the click target', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Selected and clicked text</div>
      </div>,
    )

    await clearToolbarState()

    const element = screen.getByTestId('test-element')
    // Mock selection that contains the click target
    window.getSelection = vi.fn(() => ({
      toString: vi.fn(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn((node: Node) => node === element || element.contains(node as Node)),
    })) as unknown as typeof window.getSelection

    await triggerMouseUpWithSelection(element)
    await waitFor(expectToolbarVisible)
  })

  it('should show toolbar in input even when selection does not contain click target', async () => {
    render(
      <div>
        <SelectionToolbar />
        <input data-testid="input-element" type="text" defaultValue={MOCK_SELECTED_TEXT} />
      </div>,
    )

    const element = screen.getByTestId('input-element')
    const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(element)

    // Mock selection that doesn't contain the click target
    // But this should still show toolbar because it's an input element
    window.getSelection = vi.fn(() => ({
      toString: vi.fn(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn(() => false),
    })) as unknown as typeof window.getSelection

    await triggerMouseUpWithSelection(element)
    await waitFor(expectToolbarVisible)

    spy.mockRestore()
  })
})

describe('selectionToolbar - positioning logic', () => {
  let originalRequestAnimationFrame: typeof requestAnimationFrame
  let rafCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    // Mock requestAnimationFrame to execute callbacks synchronously
    rafCallbacks = []
    originalRequestAnimationFrame = window.requestAnimationFrame
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return 0
    })

    // Mock window.getSelection with valid selection
    window.getSelection = vi.fn(() => ({
      toString: vi.fn(() => MOCK_SELECTED_TEXT),
      getRangeAt: () => ({
        startContainer: document.body,
        startOffset: 0,
        endContainer: document.body,
        endOffset: 1,
      }),
      containsNode: vi.fn(() => true),
    })) as unknown as typeof window.getSelection

    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    })

    Object.defineProperty(document.documentElement, 'clientWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    })

    // Mock scrollY and scrollX
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    })

    Object.defineProperty(window, 'scrollX', {
      writable: true,
      configurable: true,
      value: 0,
    })
  })

  afterEach(() => {
    cleanup()
    window.requestAnimationFrame = originalRequestAnimationFrame
    rafCallbacks = []
    vi.clearAllMocks()
  })

  const triggerMouseDownAndUp = async (
    target: Element,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: startX,
      clientY: startY,
    })

    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      clientX: endX,
      clientY: endY,
    })

    Object.defineProperty(mouseDownEvent, 'target', {
      value: target,
      writable: false,
    })

    Object.defineProperty(mouseUpEvent, 'target', {
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
      callbacks.forEach(cb => cb(0))
    })
  }

  const getToolbarElement = () => {
    return document.querySelector('.absolute.z-2147483647') as HTMLElement
  }

  const mockToolbarDimensions = (toolbar: HTMLElement, width: number, height: number) => {
    Object.defineProperty(toolbar, 'offsetWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(toolbar, 'offsetHeight', {
      writable: true,
      configurable: true,
      value: height,
    })
  }

  it('should position toolbar at bottom-right when selecting from top-left to bottom-right', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Select from (100, 100) to (200, 200) - bottom-right direction
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For bottom-right, toolbar should be positioned at mouseUp coordinates (200, 200)
      // Accounting for scroll offset (0) and potential clamping
      const leftValue = Number.parseInt(toolbar.style.left)
      const topValue = Number.parseInt(toolbar.style.top)
      // Should be close to mouseUp position (200, 200) for bottom-right direction
      expect(leftValue).toBeGreaterThanOrEqual(175) // Allow some margin for clamping
      expect(leftValue).toBeLessThanOrEqual(225) // Allow some margin for clamping
      expect(topValue).toBeGreaterThanOrEqual(175) // Allow some margin for clamping
      expect(topValue).toBeLessThanOrEqual(225) // Allow some margin for clamping
    })
  })

  it('should position toolbar at bottom-left when selecting from top-right to bottom-left', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Select from (200, 100) to (100, 200) - bottom-left direction
    await triggerMouseDownAndUp(target, 200, 100, 100, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For bottom-left, toolbar should be positioned at (endX - tooltipWidth, endY)
      // MouseUp is at (100, 200), so left should be less than 100 (minus tooltip width)
      const leftValue = Number.parseInt(toolbar.style.left)
      const topValue = Number.parseInt(toolbar.style.top)
      const toolbarWidth = toolbar.offsetWidth || 0
      // Left should be endX - tooltipWidth, clamped to boundaries
      expect(leftValue).toBeLessThanOrEqual(100) // Should be left of mouseUp X position
      expect(leftValue + toolbarWidth).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
      expect(topValue).toBeGreaterThanOrEqual(175) // Top should be near mouseUp Y (200)
      expect(topValue).toBeLessThanOrEqual(225) // Allow some margin
    })
  })

  it('should position toolbar at top-right when selecting from bottom-left to top-right', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Select from (100, 200) to (200, 100) - top-right direction
    await triggerMouseDownAndUp(target, 100, 200, 200, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For top-right, toolbar should be positioned at (endX, endY - tooltipHeight)
      // MouseUp is at (200, 100), so top should be less than 100 (minus tooltip height)
      const leftValue = Number.parseInt(toolbar.style.left)
      const topValue = Number.parseInt(toolbar.style.top)
      const toolbarHeight = toolbar.offsetHeight || 0
      // Left should be near mouseUp X position (200)
      expect(leftValue).toBeGreaterThanOrEqual(175) // Allow some margin for clamping
      expect(leftValue).toBeLessThanOrEqual(225) // Allow some margin
      // Top should be endY - tooltipHeight, clamped to boundaries
      expect(topValue).toBeLessThanOrEqual(100) // Should be above or at mouseUp Y position
      expect(topValue + toolbarHeight).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
    })
  })

  it('should position toolbar at top-left when selecting from bottom-right to top-left', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Select from (200, 200) to (100, 100) - top-left direction
    await triggerMouseDownAndUp(target, 200, 200, 100, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // For top-left, toolbar should be positioned at (endX - tooltipWidth, endY - tooltipHeight)
      // MouseUp is at (100, 100), so both left and top should account for toolbar dimensions
      const leftValue = Number.parseInt(toolbar.style.left)
      const topValue = Number.parseInt(toolbar.style.top)
      const toolbarWidth = toolbar.offsetWidth || 0
      const toolbarHeight = toolbar.offsetHeight || 0
      // Left should be less than mouseUp X (100) minus tooltip width
      expect(leftValue).toBeLessThanOrEqual(100) // Should be left of mouseUp X position
      expect(leftValue + toolbarWidth).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
      // Top should be less than mouseUp Y (100) minus tooltip height
      expect(topValue).toBeLessThanOrEqual(100) // Should be above or at mouseUp Y position
      expect(topValue + toolbarHeight).toBeGreaterThanOrEqual(75) // Toolbar should extend near mouseUp position
    })
  })

  it('should clamp toolbar position within left boundary', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Try to position toolbar at x=5 (less than MARGIN which is 10)
    await triggerMouseDownAndUp(target, 5, 100, 5, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // Should be clamped to at least MARGIN (10px)
      const leftValue = Number.parseInt(toolbar.style.left)
      expect(leftValue).toBeGreaterThanOrEqual(10)
    })
  })

  it('should clamp toolbar position within top boundary', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Try to position toolbar at y=5 (less than MARGIN)
    await triggerMouseDownAndUp(target, 100, 5, 100, 5)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // Should be clamped to at least MARGIN (10px)
      const topValue = Number.parseInt(toolbar.style.top)
      expect(topValue).toBeGreaterThanOrEqual(10)
    })
  })

  it('should clamp toolbar position within right boundary', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

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
        window.dispatchEvent(new Event('scroll'))
        const callbacks = [...rafCallbacks]
        rafCallbacks = []
        callbacks.forEach(cb => cb(0))
      })
    })

    await waitFor(() => {
      const toolbar = getToolbarElement()
      const leftValue = Number.parseInt(toolbar.style.left)
      const toolbarWidth = toolbar.offsetWidth
      // Should be clamped within right boundary
      // rightBoundary = clientWidth - tooltipWidth - MARGIN = 1200 - 200 - 25 = 975
      expect(leftValue).toBeLessThanOrEqual(975)
      expect(leftValue + toolbarWidth + 25).toBeLessThanOrEqual(1200) // left + width + margin <= clientWidth
    })
  })

  it('should clamp toolbar position within bottom boundary', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Try to position toolbar at y=795 (close to innerHeight of 800)
    await triggerMouseDownAndUp(target, 100, 100, 100, 795)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()

      // Mock toolbar dimensions for jsdom (no layout engine)
      // Using a realistic toolbar height of 50px
      const mockToolbarHeight = 50
      mockToolbarDimensions(toolbar, 200, mockToolbarHeight)

      // Trigger position update with mocked dimensions
      // Simulate what updatePosition does: bottomBoundary = scrollY + viewportHeight - tooltipHeight - MARGIN = 0 + 800 - 50 - 25 = 725
      // Since mouseUp is at y=795, toolbar should be clamped to top <= 725
      // Manually trigger updatePosition by dispatching a scroll event
      act(() => {
        window.dispatchEvent(new Event('scroll'))
        const callbacks = [...rafCallbacks]
        rafCallbacks = []
        callbacks.forEach(cb => cb(0))
      })
    })

    await waitFor(() => {
      const toolbar = getToolbarElement()
      const topValue = Number.parseInt(toolbar.style.top)
      const toolbarHeight = toolbar.offsetHeight
      // Should be clamped within bottom boundary
      // bottomBoundary = scrollY + viewportHeight - tooltipHeight - MARGIN = 0 + 800 - 50 - 25 = 725
      expect(topValue).toBeLessThanOrEqual(725)
      expect(topValue + toolbarHeight + 25).toBeLessThanOrEqual(800) // top + height + margin <= innerHeight
    })
  })

  it('should update toolbar position on scroll', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Initial selection at client position (100, 100) with scrollY = 0
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
    })

    const toolbar = getToolbarElement()

    // Simulate scroll down by 100px
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 100,
    })

    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach(cb => cb(0))
    })

    // After scrolling, the toolbar position should be updated
    const updatedTop = Number.parseInt(toolbar.style.top)
    // The toolbar should be clamped to at least scrollY + MARGIN (100 + 10 = 110)
    expect(updatedTop).toBeGreaterThanOrEqual(110)
  })

  it('should account for scroll offset when positioning toolbar', async () => {
    // Set initial scroll position
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 200,
    })

    Object.defineProperty(window, 'scrollX', {
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

    const target = screen.getByTestId('test-element')

    // Select at client position (100, 100)
    // Document position should be (150, 300) considering scroll
    await triggerMouseDownAndUp(target, 100, 100, 100, 100)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
      // Toolbar position should account for scroll offset
      const topValue = Number.parseInt(toolbar.style.top)
      // Should be at least scrollY + MARGIN (200 + 10 = 210)
      expect(topValue).toBeGreaterThanOrEqual(210)
    })
  })

  it('should maintain toolbar visibility when window is resized', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="test-element">Test content</div>
      </div>,
    )

    const target = screen.getByTestId('test-element')

    // Initial selection
    await triggerMouseDownAndUp(target, 100, 100, 200, 200)

    await waitFor(() => {
      const toolbar = getToolbarElement()
      expect(toolbar).toBeTruthy()
    })

    // Resize window
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 600,
    })

    Object.defineProperty(document.documentElement, 'clientWidth', {
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
