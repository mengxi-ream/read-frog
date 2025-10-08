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
    expect(document.querySelector('.absolute.z-\\[2147483647\\]')).toBeTruthy()
  }

  const expectToolbarHidden = () => {
    expect(document.querySelector('.absolute.z-\\[2147483647\\]')).toBeFalsy()
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

  it('should not show toolbar when selection does not contain the click target', async () => {
    render(
      <div>
        <SelectionToolbar />
        <div data-testid="selected-element">Selected text</div>
        <div data-testid="click-element">Click target</div>
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
