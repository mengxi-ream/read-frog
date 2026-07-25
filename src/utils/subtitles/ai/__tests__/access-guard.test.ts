// @vitest-environment jsdom
import { ORPCError } from "@orpc/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { VIDEO_TRANSCRIPTION_APPLY_URL } from "@/utils/constants/subtitles"

const getSession = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const betaAccessStatus = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const openLogIn = vi.fn<(...args: unknown[]) => void>()
const windowOpen = vi.fn<(...args: unknown[]) => void>()

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
    betaAccess: {
      status: (...args: unknown[]) => betaAccessStatus(...args),
    },
  },
}))

vi.mock("@read-frog/definitions", () => ({
  VIDEO_TRANSCRIPTION_BETA_FEATURE_KEY: "videoTranscription",
}))

const { ensureAiSubtitlesAccess, ensureBetaAllowed, ensureSignedIn } =
  await import("../access-guard")

describe("ai subtitles access guard", () => {
  beforeEach(() => {
    getSession.mockReset()
    betaAccessStatus.mockReset()
    openLogIn.mockReset()
    windowOpen.mockReset()
    vi.stubGlobal("open", windowOpen)
  })

  it("opens the log-in page and short-circuits when signed out", async () => {
    getSession.mockResolvedValue({ data: null })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(openLogIn).toHaveBeenCalledOnce()
    expect(betaAccessStatus).not.toHaveBeenCalled()
  })

  it("opens the application page when beta access is not allowed", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })
    betaAccessStatus.mockResolvedValue({ featureKey: "videoTranscription", allowed: false })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(windowOpen).toHaveBeenCalledWith(VIDEO_TRANSCRIPTION_APPLY_URL, "_blank")
  })

  it("allows access when signed in and beta is granted", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })
    betaAccessStatus.mockResolvedValue({ featureKey: "videoTranscription", allowed: true })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(true)
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it("falls through to allow when the beta status check errors (network)", async () => {
    betaAccessStatus.mockRejectedValue(new Error("network down"))

    await expect(ensureBetaAllowed()).resolves.toBe(true)
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it("treats a 401 from the beta check as unauthenticated (stale session) and opens login", async () => {
    betaAccessStatus.mockRejectedValue(new ORPCError("UNAUTHORIZED", { status: 401 }))

    await expect(ensureBetaAllowed()).resolves.toBe(false)
    expect(openLogIn).toHaveBeenCalledOnce()
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it("returns true from ensureSignedIn when a user session exists", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(openLogIn).not.toHaveBeenCalled()
  })
})
