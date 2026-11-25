// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BuiltInAiErrorToastDescription, BuiltInAiRequestId } from "../built-in-ai-request-id"

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000"

function stubClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard })
}

afterEach(() => {
  stubClipboard(undefined)
})

describe("BuiltInAiRequestId", () => {
  it("shows the whole id, so a screenshot of the error carries it", () => {
    render(<BuiltInAiRequestId requestId={REQUEST_ID} />)

    expect(screen.getByText("hostedAi.requestId.label")).toBeInTheDocument()
    expect(screen.getByText(REQUEST_ID)).toBeInTheDocument()
  })

  it("copies the id, and says so once the clipboard has it", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    stubClipboard({ writeText })
    render(<BuiltInAiRequestId requestId={REQUEST_ID} />)

    const button = screen.getByRole("button", { name: "hostedAi.requestId.copy" })
    fireEvent.click(button)

    expect(writeText).toHaveBeenCalledWith(REQUEST_ID)
    await waitFor(() => expect(button).toHaveAttribute("title", "action.copied"))
  })

  it("says Copied only for the id it copied", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    stubClipboard({ writeText })
    const { rerender } = render(<BuiltInAiRequestId requestId={REQUEST_ID} />)
    fireEvent.click(screen.getByRole("button", { name: "hostedAi.requestId.copy" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "hostedAi.requestId.copy" })).toHaveAttribute(
        "title",
        "action.copied",
      ),
    )

    rerender(<BuiltInAiRequestId requestId="0b9a1c52-6f1e-4d1f-9a54-1f7e9c2d3b4a" />)

    expect(screen.getByRole("button", { name: "hostedAi.requestId.copy" })).toHaveAttribute(
      "title",
      "hostedAi.requestId.copy",
    )
  })

  it("is phrasing content, so a toast's paragraph can hold it", () => {
    // Base UI's toast description is a <p>.
    const { container } = render(
      <p>
        <BuiltInAiErrorToastDescription message="Internal server error" requestId={REQUEST_ID} />
      </p>,
    )

    expect(container.querySelector("p div")).toBeNull()
    expect(screen.getByText(REQUEST_ID)).toBeInTheDocument()
  })

  it("leaves the id to select by hand where the page has no clipboard", () => {
    stubClipboard(undefined)
    render(<BuiltInAiRequestId requestId={REQUEST_ID} />)

    fireEvent.click(screen.getByRole("button", { name: "hostedAi.requestId.copy" }))

    expect(screen.getByText(REQUEST_ID)).toHaveClass("select-text")
  })
})
