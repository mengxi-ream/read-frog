// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { ExtensionActivationSection } from "../extension-activation"

describe("preference page sections", () => {
  it("sends the activation row to the page that holds the mode and its site list", () => {
    render(
      <MemoryRouter>
        <ExtensionActivationSection />
      </MemoryRouter>,
    )

    expect(screen.getByRole("link")).toHaveAttribute("href", "/preference/extension-activation")
  })
})
