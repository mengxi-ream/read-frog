// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SelectionSourceContent } from "../selection-source-content"

vi.mock("../copy-button", () => ({
  CopyButton: () => <button type="button">Copy</button>,
}))

vi.mock("../speak-button", () => ({
  SpeakButton: () => <button type="button">Speak</button>,
}))

function getViewport(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]")
  expect(viewport).not.toBeNull()
  return viewport as HTMLElement
}

describe("selectionSourceContent", () => {
  it("caps the expanded source text with a max height so short text keeps no blank space", () => {
    const { container } = render(<SelectionSourceContent text="use" />)

    const paragraph = screen.getByText("use")
    expect(paragraph).toHaveClass("line-clamp-3")

    // The chevron toggle is the first button rendered inside the source row.
    const toggle = container.querySelector("button")
    expect(toggle).not.toBeNull()
    fireEvent.click(toggle as HTMLButtonElement)

    expect(paragraph).not.toHaveClass("line-clamp-3")

    const viewport = getViewport(container)
    // `max-h-*` lets the area shrink to a one-word selection; a fixed `h-*`
    // would always reserve the full box and leave a blank gap under the text.
    expect(viewport).toHaveClass("max-h-18")
    expect(viewport.className).not.toMatch(/(?:^|\s)h-\d/)
    expect(getViewport(container).parentElement?.className).not.toMatch(/(?:^|\s)h-\d/)
  })

  it("does not constrain the height while collapsed", () => {
    const { container } = render(<SelectionSourceContent text="use" />)

    expect(getViewport(container).className).not.toMatch(/max-h-/)
  })
})
