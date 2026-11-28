import type { Browser } from "#imports"
import type { ProxyRequest, ProxyResponse } from "@/types/proxy-fetch"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { env } from "@/env"
import { onMessage } from "@/utils/message"

const {
  clearHostedAiStatusCacheMock,
  clearAuthCacheMock,
  getCachedMock,
  clearDifficultWordsAccessCacheMock,
  clearDifficultWordsOutboxMock,
  fetchWithSessionTokenMock,
  onSessionCookiesChangeMock,
} = vi.hoisted(() => ({
  clearHostedAiStatusCacheMock: vi.fn<() => Promise<void>>(async () => {}),
  clearAuthCacheMock: vi.fn<() => Promise<void>>(async () => {}),
  getCachedMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  clearDifficultWordsAccessCacheMock: vi.fn<() => Promise<void>>(async () => {}),
  clearDifficultWordsOutboxMock: vi.fn<() => Promise<void>>(async () => {}),
  fetchWithSessionTokenMock: vi.fn<typeof fetch>(async () => new Response("from the API")),
  onSessionCookiesChangeMock: vi.fn<(listener: () => void) => void>(),
}))

vi.mock("@/utils/message", () => ({ onMessage: vi.fn<(...args: unknown[]) => void>() }))

vi.mock("@/utils/auth/safari-session", () => ({
  fetchWithSessionToken: fetchWithSessionTokenMock,
  onSessionCookiesChange: onSessionCookiesChangeMock,
}))

vi.mock("../difficult-words", () => ({
  clearDifficultWordsAccessCache: clearDifficultWordsAccessCacheMock,
  clearDifficultWordsOutbox: clearDifficultWordsOutboxMock,
}))

vi.mock("../hosted-ai-status", () => ({
  clearHostedAiStatusCache: clearHostedAiStatusCacheMock,
}))

vi.mock("@/utils/session-cache/session-cache-group-registry", () => ({
  SessionCacheGroupRegistry: {
    getCacheGroup: async () => ({
      clear: clearAuthCacheMock,
      get: getCachedMock,
      set: async () => {},
    }),
    clearAllCacheGroup: async () => {},
  },
}))

type CookieChangeListener = (changeInfo?: Browser.cookies.CookieChangeInfo) => Promise<void>

async function setupSubject() {
  const addCookieListener = vi.fn<(listener: CookieChangeListener) => void>()
  browser.cookies.onChanged.addListener = addCookieListener
  browser.permissions.onAdded.addListener = vi.fn<(...args: unknown[]) => void>()
  browser.permissions.onRemoved.addListener = vi.fn<(...args: unknown[]) => void>()
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

type BackgroundFetch = (message: { data: ProxyRequest }) => Promise<ProxyResponse>

function backgroundFetchHandler(): BackgroundFetch {
  const registration = vi
    .mocked(onMessage)
    .mock.calls.findLast(([type]) => (type as string) === "backgroundFetch")
  if (!registration) throw new Error("Expected backgroundFetch to be handled")
  return registration[1] as unknown as BackgroundFetch
}

describe("proxyFetch in Safari", () => {
  const plainFetch = vi.fn<typeof fetch>(async () => new Response("from anywhere"))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", plainFetch)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("clears what depends on the account when the session cookies change", async () => {
    vi.stubEnv("BROWSER", "safari")
    await setupSubject()
    const onSessionChange = onSessionCookiesChangeMock.mock.calls[0]?.[0]
    if (!onSessionChange) throw new Error("Expected a session cookie listener")

    onSessionChange()

    await vi.waitFor(() => {
      expect(clearAuthCacheMock).toHaveBeenCalledOnce()
      expect(clearHostedAiStatusCacheMock).toHaveBeenCalledOnce()
      expect(clearDifficultWordsAccessCacheMock).toHaveBeenCalledOnce()
      expect(clearDifficultWordsOutboxMock).toHaveBeenCalledOnce()
    })
  })

  it("sends requests through the session-carrying fetch", async () => {
    vi.stubEnv("BROWSER", "safari")
    await setupSubject()

    const result = await backgroundFetchHandler()({
      data: { url: `${env.WXT_API_URL}/api/identity/get-session`, headers: [["X-Kept", "yes"]] },
    })

    expect(result.body).toBe("from the API")
    expect(fetchWithSessionTokenMock).toHaveBeenCalledExactlyOnceWith(
      `${env.WXT_API_URL}/api/identity/get-session`,
      expect.objectContaining({ method: "GET", credentials: "include" }),
    )
    expect(plainFetch).not.toHaveBeenCalled()
  })

  // A cached answer never reaches the API's cookie changes, an extension of
  // the session included.
  it("answers from the cache without a request", async () => {
    vi.stubEnv("BROWSER", "safari")
    await setupSubject()
    const cached = {
      status: 200,
      statusText: "OK",
      headers: [],
      body: "cached",
      bodyEncoding: "text",
    }
    getCachedMock.mockResolvedValueOnce(cached)

    const result = await backgroundFetchHandler()({
      data: {
        url: `${env.WXT_API_URL}/api/identity/get-session`,
        cacheConfig: { enabled: true, groupKey: "auth" },
      },
    })

    expect(result).toBe(cached)
    expect(fetchWithSessionTokenMock).not.toHaveBeenCalled()
  })

  it.each(["chrome", "edge", "firefox"])(
    "leaves %s's requests and cookies as they were",
    async (target) => {
      vi.stubEnv("BROWSER", target)
      await setupSubject()

      await backgroundFetchHandler()({
        data: { url: `${env.WXT_API_URL}/api/identity/get-session` },
      })

      expect(plainFetch).toHaveBeenCalledOnce()
      expect(fetchWithSessionTokenMock).not.toHaveBeenCalled()
      expect(onSessionCookiesChangeMock).not.toHaveBeenCalled()
    },
  )
})
