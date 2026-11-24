// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UsageCard } from "@/entrypoints/options/pages/usage/usage-card"

const ACCOUNT_STATE = { LOADING: "loading", GUEST: "guest", AUTHED: "authed" } as const

const account = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))

const features = vi.hoisted(() => ({ subtitlesOn: true }))

vi.mock("@/hooks/use-feature-on", () => ({
  useFeatureOn: (id: string) => (id === "videoSubtitles" ? features.subtitlesOn : true),
}))

vi.mock("@/components/user-account-menu/shared", () => ({
  ACCOUNT_STATE: { LOADING: "loading", GUEST: "guest", AUTHED: "authed" },
  AccountAvatar: () => <span data-testid="avatar" />,
  useUserAccountMenu: () => account.value,
}))

vi.mock("@/entrypoints/options/pages/usage/built-in-ai-usage", () => ({
  BuiltInAiUsage: () => <div data-testid="built-in-ai-usage" />,
}))

vi.mock("@/entrypoints/options/pages/usage/ai-subtitles-usage", () => ({
  AiSubtitlesUsage: () => <div data-testid="ai-subtitles-usage" />,
}))

vi.mock("@/utils/error-action", () => ({
  billingUrl: () => "https://readfrog.test/home",
  pricingUrl: (entry: string) => `https://readfrog.test/pricing?entry=${entry}`,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => key },
}))

function setAccount(overrides: Record<string, unknown>) {
  account.value = {
    state: ACCOUNT_STATE.AUTHED,
    user: { name: "MengXi", email: "reader@example.com", image: null },
    plan: undefined,
    displayName: "MengXi",
    isPending: false,
    logIn: vi.fn<() => void>(),
    logInAnchorRef: { current: null },
    ...overrides,
  }
}

describe("UsageCard", () => {
  const openSpy = vi.spyOn(window, "open")

  beforeEach(() => {
    openSpy.mockReset().mockReturnValue(null)
    features.subtitlesOn = true
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("shows both quota groups whoever is reading", () => {
    setAccount({ plan: "pro" })

    render(<UsageCard />)

    expect(screen.getByTestId("built-in-ai-usage")).toBeInTheDocument()
    expect(screen.getByTestId("ai-subtitles-usage")).toBeInTheDocument()
  })

  it("leaves out the AI subtitles quota when simple mode turned video subtitles off", () => {
    features.subtitlesOn = false
    setAccount({ plan: "pro" })

    render(<UsageCard />)

    expect(screen.getByTestId("built-in-ai-usage")).toBeInTheDocument()
    expect(screen.queryByTestId("ai-subtitles-usage")).not.toBeInTheDocument()
  })

  it("asks a guest to log in for the weekly free quota", () => {
    setAccount({ state: ACCOUNT_STATE.GUEST, user: undefined, displayName: "Guest" })

    render(<UsageCard />)

    expect(screen.getByText("options.usage.notSignedIn")).toBeInTheDocument()
    expect(screen.getByText("options.usage.guest")).toBeInTheDocument()
    expect(screen.getByText("options.usage.footer.logIn")).toBeInTheDocument()
    expect(screen.queryByText("options.usage.manageSubscription")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "account.login" }))
    expect(account.value.logIn).toHaveBeenCalledTimes(1)
  })

  it("offers a free account the upgrade, opened on pricing in a new tab", () => {
    setAccount({ plan: "free" })

    render(<UsageCard />)

    expect(screen.getByText("MengXi")).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByText("reader@example.com")).toBeInTheDocument()
    expect(screen.getByText("options.usage.footer.upgrade")).toBeInTheDocument()
    expect(screen.queryByText("options.usage.manageSubscription")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "options.usage.footer.upgradeAction" }))
    expect(openSpy).toHaveBeenCalledWith(
      "https://readfrog.test/pricing?entry=extension_usage_page",
      "_blank",
    )
  })

  it.each(["pro", "ultra"] as const)(
    "gives a %s subscriber only Manage subscription, and their email instead of a renewal date",
    (plan) => {
      setAccount({ plan })

      render(<UsageCard />)

      expect(screen.getByText("reader@example.com")).toBeInTheDocument()
      expect(screen.queryByText("options.usage.footer.upgrade")).not.toBeInTheDocument()
      expect(screen.queryByText("options.usage.footer.logIn")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "options.usage.manageSubscription" }))
      expect(openSpy).toHaveBeenCalledWith("https://readfrog.test/home", "_blank")
    },
  )

  it("prompts nothing while the plan is unknown", () => {
    // Signed in, but the billing lookup is still loading or failed.
    setAccount({ plan: undefined })

    render(<UsageCard />)

    expect(screen.getByText("reader@example.com")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("holds the header in skeletons while the session loads", () => {
    setAccount({ state: ACCOUNT_STATE.LOADING, user: undefined, isPending: true })

    render(<UsageCard />)

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByText("MengXi")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
