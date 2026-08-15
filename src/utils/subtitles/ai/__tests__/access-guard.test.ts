// @vitest-environment jsdom
import { ORPCError } from "@orpc/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const getUsage = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const showAiSubtitlesWallToast = vi.fn<(...args: unknown[]) => void>()

vi.mock("@/env", () => ({
  env: { WXT_WEBSITE_URL: "https://readfrog.app" },
}))

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    getSession: (...args: unknown[]) => getSession(...args),
  },
}))

vi.mock("@/utils/orpc/client", () => ({
  orpcClient: {
    videoTranscript: {
      getUsage: (...args: unknown[]) => getUsage(...args),
    },
  },
}))

vi.mock("@/utils/subtitles/toast", () => ({
  showAiSubtitlesWallToast: (...args: unknown[]) => showAiSubtitlesWallToast(...args),
}))

const { ensureAiSubtitlesAccess, ensureAiSubtitlesEntitled, ensureSignedIn } =
  await import("../access-guard")

const SIGNED_IN = { data: { user: { id: "u1" } } }

function usage(overrides: Record<string, unknown> = {}) {
  return {
    usedMinutes: 10,
    limitMinutes: 250,
    remainingMinutes: 240,
    plan: "pro",
    pools: [
      {
        id: "subscription",
        usedMinutes: 10,
        limitMinutes: 250,
        remainingMinutes: 240,
        resetAt: "2026-09-01T00:00:00.000Z",
        expiresAt: null,
      },
    ],
    ...overrides,
  }
}

/** The (title, action) pair the guard handed the toast. */
function lastToast() {
  const call = showAiSubtitlesWallToast.mock.calls.at(-1)
  return { title: call?.[0] as string, action: call?.[1] as { label: string; url: string } }
}

describe("ai subtitles access guard", () => {
  beforeEach(() => {
    getSession.mockReset()
    getUsage.mockReset()
    showAiSubtitlesWallToast.mockReset()
  })

  it("prompts to log in and short-circuits when signed out", async () => {
    getSession.mockResolvedValue({ data: null })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(getUsage).not.toHaveBeenCalled()
    expect(lastToast().title).toBe("subtitles.errors.aiLoginRequired")
    expect(lastToast().action).toEqual({
      label: "account.login",
      url: "https://readfrog.app/log-in",
    })
  })

  it("offers the upgrade without starting the flow when the plan is free", async () => {
    getSession.mockResolvedValue(SIGNED_IN)
    getUsage.mockResolvedValue(usage({ plan: "free", remainingMinutes: 0, pools: [] }))

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(lastToast().title).toBe("subtitles.errors.aiSubscriptionRequired")
    expect(lastToast().action).toEqual({
      label: "action.upgrade",
      url: "https://readfrog.app/pricing",
    })
  })

  it("names the reset date when a subscriber has run the quota dry", async () => {
    getUsage.mockResolvedValue(
      usage({
        remainingMinutes: 0,
        pools: [
          {
            id: "subscription",
            usedMinutes: 250,
            limitMinutes: 250,
            remainingMinutes: 0,
            resetAt: "2026-09-01T00:00:00.000Z",
            expiresAt: null,
          },
        ],
      }),
    )

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(false)
    expect(lastToast().title).toBe("subtitles.errors.aiQuotaExceededWithReset")
  })

  // The launch gift expires and never refills, so its date cannot answer
  // "when does my quota come back".
  it("falls back to the dateless message when only the launch gift has a date", async () => {
    getUsage.mockResolvedValue(
      usage({
        remainingMinutes: 0,
        pools: [
          {
            id: "launchBonus",
            usedMinutes: 60,
            limitMinutes: 60,
            remainingMinutes: 0,
            resetAt: null,
            expiresAt: "2026-10-01T00:00:00.000Z",
          },
        ],
      }),
    )

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(false)
    expect(lastToast().title).toBe("subtitles.errors.aiQuotaExceeded")
  })

  // Ultra is the top plan — there is nothing left to sell someone already on it.
  it("offers no upgrade when an Ultra subscriber runs the quota dry", async () => {
    getUsage.mockResolvedValue(usage({ plan: "ultra", remainingMinutes: 0 }))

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(false)
    expect(lastToast().title).toBe("subtitles.errors.aiQuotaExceededWithReset")
    expect(lastToast().action).toBeUndefined()
  })

  it("reads a pre-launch server's beta 403 as needing a plan", async () => {
    getUsage.mockRejectedValue(new ORPCError("FORBIDDEN", { status: 403 }))

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(false)
    expect(lastToast().title).toBe("subtitles.errors.aiSubscriptionRequired")
    expect(lastToast().action?.url).toBe("https://readfrog.app/pricing")
  })

  // Responses are not runtime-validated, so a server that predates `plan` must
  // fall through rather than read as free.
  it("lets a response without a plan field through", async () => {
    getUsage.mockResolvedValue({ usedMinutes: 0, limitMinutes: 250, remainingMinutes: 250 })

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(true)
    expect(showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  it("lets a subscriber with quota left through without a toast", async () => {
    getSession.mockResolvedValue(SIGNED_IN)
    getUsage.mockResolvedValue(usage())

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(true)
    expect(showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  // A network blip must not wall off a paying subscriber; `create` stays the authority.
  it("fails open when the usage check errors", async () => {
    getUsage.mockRejectedValue(new Error("network down"))

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(true)
    expect(showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })

  it("treats a 401 from the usage check as a stale session and prompts to log in", async () => {
    getUsage.mockRejectedValue(new ORPCError("UNAUTHORIZED", { status: 401 }))

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(false)
    expect(lastToast().title).toBe("subtitles.errors.aiLoginRequired")
  })

  it("returns true from ensureSignedIn when a user session exists", async () => {
    getSession.mockResolvedValue(SIGNED_IN)

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(showAiSubtitlesWallToast).not.toHaveBeenCalled()
  })
})
