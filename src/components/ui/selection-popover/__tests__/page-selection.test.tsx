// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SelectionPopover } from ".."

// Unlike selection-popover.test.tsx, this file keeps the real react-rnd: the
// page selection was cleared by react-draggable, which react-rnd drives.

let rafCallbacks: FrameRequestCallback[] = []
let pageNodes: HTMLElement[] = []

function flushRaf() {
  act(() => {
    const callbacks = rafCallbacks
    rafCallbacks = []
    callbacks.forEach((callback) => callback(0))
  })
}

function selectPageText(text: string) {
  const paragraph = document.createElement("p")
  paragraph.textContent = text
  document.body.append(paragraph)
  pageNodes.push(paragraph)
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  window.getSelection()!.addRange(range)
}

function openPopover() {
  render(
    <SelectionPopover.Root>
      <SelectionPopover.Trigger>Open popover</SelectionPopover.Trigger>
      <SelectionPopover.Content>
        <SelectionPopover.Header>
          <SelectionPopover.Title>Translation</SelectionPopover.Title>
          <SelectionPopover.Close />
        </SelectionPopover.Header>
        <SelectionPopover.Body>
          <div>Popover content</div>
        </SelectionPopover.Body>
      </SelectionPopover.Content>
    </SelectionPopover.Root>,
  )
  fireEvent.click(screen.getByRole("button", { name: "Open popover" }))
  flushRaf()
  expect(screen.getByText("Popover content")).toBeInTheDocument()
}

describe("selectionPopover and the page selection", () => {
  beforeEach(() => {
    rafCallbacks = []
    pageNodes = []
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.getSelection()?.removeAllRanges()
    pageNodes.forEach((node) => node.remove())
  })

  // Closing the card by selecting new text on the page used to wipe that text's
  // selection one frame later, so the toolbar never showed for it.
  it("keeps the page selection when the popover closes", () => {
    openPopover()
    selectPageText("Newly selected text")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    flushRaf()

    expect(screen.queryByText("Popover content")).not.toBeInTheDocument()
    expect(window.getSelection()!.toString()).toBe("Newly selected text")
  })

  it("keeps the page selection when the popover is dragged", () => {
    openPopover()
    selectPageText("Selected text")

    const handle = screen.getByText("Translation")
    fireEvent.mouseDown(handle, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseMove(document, { clientX: 60, clientY: 40 })
    fireEvent.mouseUp(document, { clientX: 60, clientY: 40 })
    flushRaf()

    expect(window.getSelection()!.toString()).toBe("Selected text")
  })
})
