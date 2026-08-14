// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const openLogIn = vi.fn<(...args: unknown[]) => void>()

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    getSession: (...args: unknown[]) => getSession(...args),
  },
}))

vi.mock("@/components/user-account-menu/shared", () => ({
  openLogIn: (...args: unknown[]) => openLogIn(...args),
}))

const { ensureAiSubtitlesAccess, ensureSignedIn } = await import("../access-guard")

describe("ai subtitles access guard", () => {
  beforeEach(() => {
    getSession.mockReset()
    openLogIn.mockReset()
  })

  it("opens the log-in page and short-circuits when signed out", async () => {
    getSession.mockResolvedValue({ data: null })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(false)
    expect(openLogIn).toHaveBeenCalledOnce()
  })

  // Sign-in is the ONLY client-side pre-check: the subscription wall is the
  // server's create response, rendered by the request path — no plan
  // pre-flight exists to drift out of sync with it.
  it("allows a signed-in user through without any further pre-flight", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })

    await expect(ensureAiSubtitlesAccess()).resolves.toBe(true)
    expect(openLogIn).not.toHaveBeenCalled()
  })

  it("returns true from ensureSignedIn when a user session exists", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1" } } })

    await expect(ensureSignedIn()).resolves.toBe(true)
    expect(openLogIn).not.toHaveBeenCalled()
  })
})
