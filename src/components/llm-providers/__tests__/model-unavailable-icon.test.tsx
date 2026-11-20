// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { ModelUnavailableIcon } from "../model-unavailable-icon"

const REASON = "GPT-6.2 Sol is temporarily unavailable. Try GPT-6 Luna instead."

describe("ModelUnavailableIcon", () => {
  it("names the icon with the reason, so a screen reader reads it", () => {
    render(
      <TooltipProvider>
        <ModelUnavailableIcon reason={REASON} />
      </TooltipProvider>,
    )

    const icon = screen.getByRole("img", { name: REASON })
    // Not focusable: inside a menu option, a focusable child breaks the
    // listbox's arrow-key navigation.
    expect(icon).not.toHaveAttribute("tabindex")
    expect(icon.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("shows the reason in a tooltip on hover", async () => {
    render(
      <TooltipProvider>
        <ModelUnavailableIcon reason={REASON} />
      </TooltipProvider>,
    )

    const icon = screen.getByRole("img", { name: REASON })
    fireEvent.mouseEnter(icon)
    fireEvent.focus(icon)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent(REASON)
    })
  })
})
