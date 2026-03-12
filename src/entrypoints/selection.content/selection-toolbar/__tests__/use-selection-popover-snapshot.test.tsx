// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { selectionContentAtom, selectionRangeAtom } from "../atom"
import { useSelectionPopoverSnapshot } from "../use-selection-popover-snapshot"

function createRangeFor(node: Node) {
  const range = document.createRange()
  range.selectNodeContents(node)
  return range
}

function SnapshotProbe() {
  const [open, setOpen] = useState(false)
  const {
    popoverSessionKey,
    selectionContentSnapshot,
    selectionRangeSnapshot,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  } = useSelectionPopoverSnapshot()

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (open) {
            clearSelectionSnapshot()
          }
          else {
            captureSelectionSnapshot()
          }
          setOpen(prev => !prev)
        }}
      >
        {open ? "Close" : "Open"}
      </button>
      <button type="button" onClick={captureSelectionSnapshot}>
        Refresh
      </button>
      <div data-testid="session-key">{popoverSessionKey}</div>
      <div data-testid="selection-content">{selectionContentSnapshot ?? "empty"}</div>
      <div data-testid="selection-range">{selectionRangeSnapshot?.toString() ?? "empty"}</div>
    </div>
  )
}

describe("useSelectionPopoverSnapshot", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("keeps the captured selection stable until the popover is reopened", () => {
    const firstNode = document.createElement("span")
    firstNode.textContent = "First selection"
    const secondNode = document.createElement("span")
    secondNode.textContent = "Second selection"
    document.body.append(firstNode, secondNode)

    const firstRange = createRangeFor(firstNode)
    const secondRange = createRangeFor(secondNode)
    const store = createStore()
    store.set(selectionContentAtom, "First selection")
    store.set(selectionRangeAtom, firstRange)

    render(
      <Provider store={store}>
        <SnapshotProbe />
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByTestId("session-key")).toHaveTextContent("1")
    expect(screen.getByTestId("selection-content")).toHaveTextContent("First selection")
    expect(screen.getByTestId("selection-range")).toHaveTextContent("First selection")

    act(() => {
      store.set(selectionContentAtom, "Second selection")
      store.set(selectionRangeAtom, secondRange)
    })

    expect(screen.getByTestId("selection-content")).toHaveTextContent("First selection")
    expect(screen.getByTestId("selection-range")).toHaveTextContent("First selection")

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(screen.getByTestId("session-key")).toHaveTextContent("2")
    expect(screen.getByTestId("selection-content")).toHaveTextContent("Second selection")
    expect(screen.getByTestId("selection-range")).toHaveTextContent("Second selection")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByTestId("selection-content")).toHaveTextContent("empty")
    expect(screen.getByTestId("selection-range")).toHaveTextContent("empty")

    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByTestId("session-key")).toHaveTextContent("3")
    expect(screen.getByTestId("selection-content")).toHaveTextContent("Second selection")
    expect(screen.getByTestId("selection-range")).toHaveTextContent("Second selection")
  })
})
