// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StateMessage } from "../state-message"

describe("StateMessage", () => {
  it("cuts a long error short at the player's edge, with the whole text on hover", () => {
    const message =
      "OpenAI: Incorrect API key provided: sk-proj-****1234. You can find your API key at https://platform.openai.com/account/api-keys."

    render(<StateMessage state="error" message={message} />)

    const text = screen.getByText(message)
    expect(text).toHaveClass("truncate")
    expect(text.closest("[title]")).toHaveAttribute("title", message)
  })

  it("names a failed Built-in AI call's id on hover, beside a button that copies it", () => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000"
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })

    render(
      <StateMessage
        state="error"
        message="Built-in AI: Internal server error"
        requestId={requestId}
      />,
    )

    expect(
      screen.getByText("Built-in AI: Internal server error").closest("[title]"),
    ).toHaveAttribute(
      "title",
      `Built-in AI: Internal server error\nhostedAi.requestId.label ${requestId}`,
    )
    fireEvent.click(screen.getByRole("button", { name: "hostedAi.requestId.copy" }))
    expect(writeText).toHaveBeenCalledWith(requestId)
  })
})
