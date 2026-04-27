// @vitest-environment jsdom
import type { ComponentProps } from "react"
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

vi.mock("@/env", () => ({
  env: {
    WXT_WEBSITE_URL: "https://readfrog.app",
  },
}))

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
  },
}))

vi.mock("@/components/ui/base-ui/avatar", () => ({
  Avatar: ({
    children,
    className,
    size = "default",
  }: ComponentProps<"span"> & { size?: "default" | "sm" | "lg" }) => (
    <span data-slot="avatar" data-size={size} className={className}>
      {children}
    </span>
  ),
  AvatarImage: (props: ComponentProps<"img">) => props.src ? <img data-slot="avatar-image" {...props} /> : null,
  AvatarFallback: ({ children }: ComponentProps<"span">) => (
    <span data-slot="avatar-fallback">{children}</span>
  ),
}))

describe("user account", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState.data = null
    sessionState.isPending = false
  })

  it("shows the guest image and login action when signed out", async () => {
    const { UserAccount } = await import("../user-account")

    render(<UserAccount />)

    const image = screen.getByRole("img", { name: "Guest" })
    expect(image).toHaveAttribute("src", guest)
    expect(screen.getByText("Guest")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
  })

  it("treats a session payload without user as signed out", async () => {
    sessionState.data = { session: { id: "session-1" } }
    const { UserAccount } = await import("../user-account")

    expect(() => render(<UserAccount />)).not.toThrow()

    const image = screen.getByRole("img", { name: "Guest" })
    expect(image).toHaveAttribute("src", guest)
    expect(screen.getByText("Guest")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
  })

  it("shows the user's avatar and name when signed in with an image", async () => {
    sessionState.data = {
      user: {
        name: "John Doe",
        image: "https://cdn.example.com/john.png",
      },
    }
    const { UserAccount } = await import("../user-account")

    render(<UserAccount />)

    expect(screen.getByRole("img", { name: "John Doe" })).toHaveAttribute("src", "https://cdn.example.com/john.png")
    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument()
  })

  it("uses initials fallback for signed-in users without an image", async () => {
    sessionState.data = {
      user: {
        name: "John Doe",
        image: null,
      },
    }
    const { UserAccount } = await import("../user-account")

    render(<UserAccount />)

    expect(screen.queryByRole("img", { name: "John Doe" })).not.toBeInTheDocument()
    expect(screen.getByText("JD")).toBeInTheDocument()
    expect(screen.getByText("John Doe")).toBeInTheDocument()
  })

  it("keeps the loading state without showing login", async () => {
    sessionState.isPending = true
    const { UserAccount } = await import("../user-account")

    const view = render(<UserAccount />)

    expect(screen.getByText("Loading...")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument()
    expect(view.container.querySelector("[data-slot='avatar']")).toHaveClass("animate-pulse")
  })
})
