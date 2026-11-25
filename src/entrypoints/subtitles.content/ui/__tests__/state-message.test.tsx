// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
})
