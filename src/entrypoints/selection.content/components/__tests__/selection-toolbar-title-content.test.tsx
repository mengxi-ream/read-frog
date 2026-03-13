// @vitest-environment jsdom
import type * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SelectionToolbarTitleContent } from "../selection-toolbar-title-content"

vi.mock("@/components/ui/selection-popover", () => ({
  SelectionPopover: {
    Title: ({ children, className }: { children: React.ReactNode, className?: string }) => (
      <span className={className}>{children}</span>
    ),
  },
}))

vi.mock("@iconify/react", () => ({
  Icon: ({ className, icon, strokeWidth }: { className?: string, icon: string, strokeWidth?: number }) => (
    <span
      aria-hidden="true"
      className={className}
      data-icon={icon}
      data-stroke-width={strokeWidth}
      data-testid="selection-toolbar-title-icon"
    />
  ),
}))

describe("selectionToolbarTitleContent", () => {
  it("renders a string icon with the muted foreground color", () => {
    render(
      <SelectionToolbarTitleContent
        icon="tabler:sparkles"
        title="Vocabulary Insight"
      />,
    )

    expect(screen.getByText("Vocabulary Insight")).toBeInTheDocument()
    expect(screen.getByTestId("selection-toolbar-title-icon")).toHaveAttribute("data-icon", "tabler:sparkles")
    expect(screen.getByTestId("selection-toolbar-title-icon")).toHaveClass("text-muted-foreground")
  })
})
