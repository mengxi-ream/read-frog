// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import guest from "@/assets/icons/avatars/guest.svg"

const { sessionState, useSessionMock } = vi.hoisted(() => ({
  sessionState: {
    data: null as unknown,
    isPending: false,
  },
  useSessionMock: vi.fn(() => sessionState),
}))

vi.mock("#imports", () => ({
  i18n: { t: (key: string) => key },
}))

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

vi.mock("@/env", () => ({
  env: { WXT_WEBSITE_URL: "https://readfrog.app" },
}))

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}))

vi.mock("@/components/ui/base-ui/avatar", () => ({
  Avatar: ({ children, className }: ComponentProps<"span">) => (
    <span data-slot="avatar" className={className}>{children}</span>
  ),
  AvatarImage: (props: ComponentProps<"img">) => props.src ? <img data-slot="avatar-image" {...props} /> : null,
  AvatarFallback: ({ children }: ComponentProps<"span">) => <span data-slot="avatar-fallback">{children}</span>,
}))

vi.mock("@/components/ui/base-ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children, render: _render, tooltip: _tooltip, ...props }: ComponentProps<"button"> & { render?: unknown, tooltip?: unknown }) => (
    <button type="button" {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/base-ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: ComponentProps<"button">) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

async function importMenus() {
  const { UserAccountMenuPopup } = await import("../user-account-menu/popup")
  const { UserAccountMenuSidebar } = await import("../user-account-menu/sidebar")
  return { UserAccountMenuPopup, UserAccountMenuSidebar }
}

describe("userAccountMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState.data = null
    sessionState.isPending = false
  })

  it("shows the guest image and login action when signed out", async () => {
    const { UserAccountMenuPopup, UserAccountMenuSidebar } = await importMenus()

    const popup = render(<UserAccountMenuPopup />)
    expect(screen.getByRole("img", { name: "Guest" })).toHaveAttribute("src", guest)
    expect(screen.getByRole("button", { name: "account.login" })).toBeInTheDocument()
    popup.unmount()

    render(<UserAccountMenuSidebar />)
    expect(screen.getByText("account.login")).toBeInTheDocument()
  })

  it("shows the user name when signed in", async () => {
    sessionState.data = { user: { name: "John Doe", image: null, email: "john@example.com" } }
    const { UserAccountMenuPopup } = await importMenus()
    render(<UserAccountMenuPopup />)

    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "account.login" })).not.toBeInTheDocument()
  })

  it("shows a non-interactive placeholder while loading", async () => {
    sessionState.isPending = true
    const { UserAccountMenuPopup } = await importMenus()
    render(<UserAccountMenuPopup />)

    expect(screen.queryByRole("button", { name: "account.login" })).not.toBeInTheDocument()
  })
})
