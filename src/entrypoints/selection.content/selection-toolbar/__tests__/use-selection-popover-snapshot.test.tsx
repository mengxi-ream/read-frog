// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { buildContextSnapshot, createRangeSnapshot } from "../../utils"
import { contextAtom, selectionAtom } from "../atoms"
import { useSelectionPopoverSnapshot } from "../use-selection-popover-snapshot"

function createSelectionSnapshot(node: Node, text: string) {
  const range = document.createRange()
  range.selectNodeContents(node)

  return {
    text,
    ranges: [
      createRangeSnapshot({
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      }),
    ],
  }
}

function SnapshotProbe() {
  const [open, setOpen] = useState(false)
  const {
    contextSnapshot,
    popoverSessionKey,
    selectionSnapshot,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  } = useSelectionPopoverSnapshot()
  const selectionText = selectionSnapshot?.text ?? null

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
      <div data-testid="selection-content">{selectionText ?? "empty"}</div>
      <div data-testid="context-text">{contextSnapshot?.text ?? "empty"}</div>
    </div>
  )
}

describe("useSelectionPopoverSnapshot", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("keeps the captured selection and context stable until the popover is reopened", () => {
    const firstParagraph = document.createElement("p")
    firstParagraph.textContent = "First selection paragraph"
    const secondParagraph = document.createElement("p")
    secondParagraph.textContent = "Second selection paragraph"
    document.body.append(firstParagraph, secondParagraph)

    const firstSelection = createSelectionSnapshot(firstParagraph, "First selection paragraph")
    const secondSelection = createSelectionSnapshot(secondParagraph, "Second selection paragraph")
    const store = createStore()
    store.set(selectionAtom, firstSelection)
    store.set(contextAtom, buildContextSnapshot(firstSelection))

    render(
      <Provider store={store}>
        <SnapshotProbe />
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByTestId("session-key")).toHaveTextContent("1")
    expect(screen.getByTestId("selection-content")).toHaveTextContent("First selection paragraph")
    expect(screen.getByTestId("context-text")).toHaveTextContent("First selection paragraph")

    act(() => {
      store.set(selectionAtom, secondSelection)
      store.set(contextAtom, buildContextSnapshot(secondSelection))
    })

    expect(screen.getByTestId("selection-content")).toHaveTextContent("First selection paragraph")
    expect(screen.getByTestId("context-text")).toHaveTextContent("First selection paragraph")

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(screen.getByTestId("session-key")).toHaveTextContent("2")
    expect(screen.getByTestId("selection-content")).toHaveTextContent("Second selection paragraph")
    expect(screen.getByTestId("context-text")).toHaveTextContent("Second selection paragraph")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByTestId("selection-content")).toHaveTextContent("empty")
    expect(screen.getByTestId("context-text")).toHaveTextContent("empty")

    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByTestId("session-key")).toHaveTextContent("3")
    expect(screen.getByTestId("selection-content")).toHaveTextContent("Second selection paragraph")
    expect(screen.getByTestId("context-text")).toHaveTextContent("Second selection paragraph")
  })
})
