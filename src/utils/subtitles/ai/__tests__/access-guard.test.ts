// @vitest-environment jsdom
import { ORPCError } from "@orpc/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const getUsage = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const openLogIn = vi.fn<(...args: unknown[]) => void>()
const sendMessage = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    getSession: (...args: unknown[]) => getSession(...args),
  },
}))

vi.mock("@/components/user-account-menu/shared", () => ({
  openLogIn: (...args: unknown[]) => openLogIn(...args),
}))

vi.mock("@/utils/orpc/client", () => ({
  orpcClient: {
    videoTranscript: {
      getUsage: (...args: unknown[]) => getUsage(...args),
    },
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: unknown[]) => sendMessage(...args),
}))

vi.mock("@/env", () => ({
  env: { WXT_WEBSITE_URL: "https://www.readfrog.app" },
}))

const { ensureAiSubtitlesAccess, ensureAiSubtitlesEntitled, ensureSignedIn } =
  await import("../access-guard")

describe("ai subtitles access guard", () => {
  beforeEach(() => {
    getSession.mockReset()
    getUsage.mockReset()
    openLogIn.mockReset()
    sendMessage.mockReset()
    sendMessage.mockResolvedValue(undefined)
  })

  it("opens the log-in page and short-circuits when signed out", async () => {
    getSession.mockResolvedValue({ data: null })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(openLogIn).toHaveBeenCalledOnce()
    expect(getUsage).not.toHaveBeenCalled()
  })

  it("opens the pricing page when the plan does not cover AI subtitles", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })
    getUsage.mockRejectedValue(
      new ORPCError("VIDEO_TRANSCRIPTION_BETA_RESTRICTED", { status: 403 }),
    )

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(sendMessage).toHaveBeenCalledWith("openPage", {
      url: "https://www.readfrog.app/pricing",
      active: true,
    })
    expect(openLogIn).not.toHaveBeenCalled()
  })

  it("allows access when signed in and the quota call succeeds", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })
    getUsage.mockResolvedValue({ usedMinutes: 0, limitMinutes: 250, remainingMinutes: 250 })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(true)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("falls through to allow when the quota check errors (network)", async () => {
    getUsage.mockRejectedValue(new Error("network down"))

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(true)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("treats a 401 from the quota check as unauthenticated (stale session) and opens login", async () => {
    getUsage.mockRejectedValue(new ORPCError("UNAUTHORIZED", { status: 401 }))

    await expect(ensureAiSubtitlesEntitled()).resolves.toBe(false)
    expect(openLogIn).toHaveBeenCalledOnce()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("returns true from ensureSignedIn when a user session exists", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(openLogIn).not.toHaveBeenCalled()
  })
})
