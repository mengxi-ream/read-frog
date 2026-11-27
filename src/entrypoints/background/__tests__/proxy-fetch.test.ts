import type { Browser } from "#imports"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { env } from "@/env"

const { clearHostedAiStatusCacheMock, clearAuthCacheMock } = vi.hoisted(() => ({
  clearHostedAiStatusCacheMock: vi.fn<() => Promise<void>>(async () => {}),
  clearAuthCacheMock: vi.fn<() => Promise<void>>(async () => {}),
}))

vi.mock("@/utils/message", () => ({ onMessage: vi.fn<(...args: unknown[]) => void>() }))

vi.mock("../hosted-ai-status", () => ({
  clearHostedAiStatusCache: clearHostedAiStatusCacheMock,
}))

vi.mock("@/utils/session-cache/session-cache-group-registry", () => ({
  SessionCacheGroupRegistry: {
    getCacheGroup: async () => ({ clear: clearAuthCacheMock }),
    clearAllCacheGroup: async () => {},
  },
}))

type CookieChangeListener = (changeInfo?: Browser.cookies.CookieChangeInfo) => Promise<void>

async function setupSubject() {
  const addCookieListener = vi.fn<(listener: CookieChangeListener) => void>()
  browser.cookies.onChanged.addListener = addCookieListener
  browser.permissions.onAdded.addListener = vi.fn<(...args: unknown[]) => void>()
  const { proxyFetch } = await import("../proxy-fetch")
  proxyFetch()

  const listener = addCookieListener.mock.calls[0]?.[0]
  if (!listener) {
    throw new Error("Expected cookies.onChanged listener to be registered")
  }
  return listener
}

describe("proxyFetch auth cookie listener", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("clears the auth cache when the session cookie changes", async () => {
    const onCookieChanged = await setupSubject()

    await onCookieChanged({
      cookie: {
        domain: `.${env.WXT_AUTH_COOKIE_DOMAINS[0]}`,
        name: "__Secure-better-auth.session_token",
        value: "token-1",
      } as Browser.cookies.Cookie,
      removed: false,
      cause: "explicit",
    })

    await vi.waitFor(() => expect(clearHostedAiStatusCacheMock).toHaveBeenCalledOnce())
    expect(clearAuthCacheMock).toHaveBeenCalledOnce()
  })

  // Safari calls the listener with no argument at all.
  it("ignores a cookie change that comes with no details", async () => {
    const onCookieChanged = await setupSubject()

    await expect(onCookieChanged(undefined)).resolves.toBeUndefined()

    expect(clearHostedAiStatusCacheMock).not.toHaveBeenCalled()
    expect(clearAuthCacheMock).not.toHaveBeenCalled()
  })
})
