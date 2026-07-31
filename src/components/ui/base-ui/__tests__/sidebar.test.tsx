// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/base-ui/sidebar"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"

// jsdom has no matchMedia, which the sidebar's mobile check needs.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
})

function renderMenuButton(props: React.ComponentProps<typeof SidebarMenuButton>) {
  return render(
    <SidebarProvider>
      <TooltipProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton {...props} />
          </SidebarMenuItem>
        </SidebarMenu>
      </TooltipProvider>
    </SidebarProvider>,
  )
}

describe("sidebarMenuButton", () => {
  it("keeps the caller's render element when a tooltip is set", () => {
    renderMenuButton({
      render: <a href="https://example.com" />,
      tooltip: "Statistics",
      children: <span>Statistics</span>,
    })

    expect(screen.getByRole("link", { name: "Statistics" })).toHaveAttribute(
      "href",
      "https://example.com",
    )
  })

  it("falls back to a button when no render element is given", () => {
    renderMenuButton({ tooltip: "Statistics", children: <span>Statistics</span> })

    expect(screen.getByRole("button", { name: "Statistics" })).toBeInTheDocument()
  })
})
