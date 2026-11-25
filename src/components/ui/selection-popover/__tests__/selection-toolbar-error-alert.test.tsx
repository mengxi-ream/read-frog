// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SelectionToolbarErrorAlert } from "../selection-toolbar-error-alert"

describe("SelectionToolbarErrorAlert", () => {
  it("shows a failed Built-in AI call's request id under its message", () => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000"

    render(
      <SelectionToolbarErrorAlert
        error={{ title: "Translation failed", description: "Internal server error", requestId }}
      />,
    )

    expect(screen.getByText("Internal server error")).toBeInTheDocument()
    expect(screen.getByText(requestId)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "hostedAi.requestId.copy" })).toBeInTheDocument()
  })

  it("shows no id for an error without one", () => {
    render(
      <SelectionToolbarErrorAlert
        error={{ title: "Translation failed", description: "Incorrect API key provided" }}
      />,
    )

    expect(screen.queryByText("hostedAi.requestId.label")).not.toBeInTheDocument()
  })
})
