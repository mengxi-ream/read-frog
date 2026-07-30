import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"

const { getItemMock, removeItemMock, setItemMock } = vi.hoisted(() => ({
  getItemMock: vi.fn<(...args: any[]) => any>(),
  removeItemMock: vi.fn<(...args: any[]) => any>(),
  setItemMock: vi.fn<(...args: any[]) => any>(),
}))

import {
  clearCodexOAuthAuth,
  CODEX_API_BASE_URL,
  codexOAuthFetch,
  completeCodexDeviceAuthorization,
  getValidCodexOAuthAuth,
  startCodexDeviceAuthorization,
} from "../codex-oauth"

function createJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_")
  return `e30.${encoded.replace(/=+$/, "")}.signature`
}

describe("Codex OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getItemMock.mockResolvedValue(null)
    ;(storage.getItem as unknown as typeof getItemMock) = getItemMock
    ;(storage.removeItem as unknown as typeof removeItemMock) = removeItemMock
    ;(storage.setItem as unknown as typeof setItemMock) = setItemMock
  })

  it("completes device authorization and stores the ChatGPT account", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
      const url = input instanceof URL ? input.href : typeof input === "string" ? input : input.url
      if (url.endsWith("/api/accounts/deviceauth/usercode")) {
        return new Response(
          JSON.stringify({ device_auth_id: "device-id", user_code: "ABCD-EFGH", interval: "5" }),
          { status: 200 },
        )
      }
      if (url.endsWith("/api/accounts/deviceauth/token")) {
        return new Response(
          JSON.stringify({ authorization_code: "authorization-code", code_verifier: "verifier" }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          id_token: createJwt({
            email: "frog@example.com",
            "https://api.openai.com/auth": { chatgpt_account_id: "account-id" },
          }),
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    const device = await startCodexDeviceAuthorization(fetchMock)
    const auth = await completeCodexDeviceAuthorization(device, { fetchFn: fetchMock })

    expect(device).toEqual({ deviceAuthId: "device-id", userCode: "ABCD-EFGH", intervalMs: 5000 })
    expect(auth).toEqual(
      expect.objectContaining({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        accountId: "account-id",
        email: "frog@example.com",
      }),
    )
    expect(setItemMock).toHaveBeenCalledWith("local:codexOAuthAuth", auth)
  })

  it("refreshes an expired token without falling back to the old token", async () => {
    getItemMock.mockResolvedValue({
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
      expiresAt: 0,
      accountId: "account-id",
    })
    const fetchMock = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch

    const auth = await getValidCodexOAuthAuth(fetchMock)

    expect(auth.accessToken).toBe("new-access-token")
    expect(auth.refreshToken).toBe("new-refresh-token")
    expect(setItemMock).toHaveBeenCalledWith("local:codexOAuthAuth", auth)
  })

  it("does not restore credentials when the user signs out during refresh", async () => {
    const expiredAuth = {
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
      expiresAt: 0,
      accountId: "account-id",
    }
    getItemMock.mockResolvedValueOnce(expiredAuth).mockResolvedValueOnce(null)
    const fetchMock = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch

    await expect(getValidCodexOAuthAuth(fetchMock)).rejects.toThrow(
      "Codex OAuth session changed during token refresh",
    )
    expect(setItemMock).not.toHaveBeenCalled()
  })

  it("injects OAuth headers only for the Codex backend", async () => {
    getItemMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 3_600_000,
      accountId: "account-id",
    })
    const completedResponse = { id: "response-id", output: [], status: "completed" }
    let streamCancelled = false
    const encoder = new TextEncoder()
    const networkFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: completedResponse })}\n\n`,
                ),
              )
            },
            cancel() {
              streamCancelled = true
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
    )
    vi.stubGlobal("fetch", networkFetch)

    const response = await codexOAuthFetch(`${CODEX_API_BASE_URL}/responses`, {
      method: "POST",
      headers: { "X-Test": "value" },
      body: JSON.stringify({ model: "gpt-5.4-mini", store: true }),
    })

    const [request] = networkFetch.mock.calls[0]!
    const forwardedRequest = request as Request
    const headers = new Headers(forwardedRequest.headers)
    expect(headers.get("Authorization")).toBe("Bearer access-token")
    expect(headers.get("ChatGPT-Account-Id")).toBe("account-id")
    expect(headers.get("originator")).toBe("read-frog")
    expect(headers.get("X-Test")).toBe("value")
    await expect(forwardedRequest.clone().json()).resolves.toEqual({
      model: "gpt-5.4-mini",
      store: false,
      stream: true,
    })
    await expect(response.json()).resolves.toEqual(completedResponse)
    expect(streamCancelled).toBe(true)

    await expect(codexOAuthFetch("https://example.com/responses")).rejects.toThrow(
      "Refusing to send Codex OAuth credentials",
    )
    expect(networkFetch).toHaveBeenCalledOnce()
  })

  it("limits streaming Codex requests to two active response bodies", async () => {
    getItemMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 3_600_000,
      accountId: "account-id",
    })
    const controllers: ReadableStreamDefaultController<Uint8Array>[] = []
    const networkFetch = vi.fn<() => Promise<Response>>(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controllers.push(controller)
        },
      })
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    })
    vi.stubGlobal("fetch", networkFetch)

    const createRequest = () =>
      codexOAuthFetch(`${CODEX_API_BASE_URL}/responses`, {
        method: "POST",
        body: JSON.stringify({ model: "gpt-5.4-mini", stream: true }),
      })
    const firstPromise = createRequest()
    const secondPromise = createRequest()
    const thirdPromise = createRequest()
    const [firstResponse, secondResponse] = await Promise.all([firstPromise, secondPromise])

    expect(networkFetch).toHaveBeenCalledTimes(2)

    controllers[0]!.close()
    await firstResponse.text()
    const thirdResponse = await thirdPromise
    expect(networkFetch).toHaveBeenCalledTimes(3)

    controllers[1]!.close()
    controllers[2]!.close()
    await Promise.all([secondResponse.text(), thirdResponse.text()])
  })

  it("closes streaming responses when Codex sends a terminal event", async () => {
    getItemMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 3_600_000,
      accountId: "account-id",
    })
    let streamCancelled = false
    const encoder = new TextEncoder()
    const networkFetch = vi.fn<() => Promise<Response>>(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: response.created\ndata: ${JSON.stringify({ type: "response.created" })}\n\n` +
                `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { id: "response-id" } })}\n\n`,
            ),
          )
        },
        cancel() {
          streamCancelled = true
        },
      })
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    })
    vi.stubGlobal("fetch", networkFetch)

    const response = await codexOAuthFetch(`${CODEX_API_BASE_URL}/responses`, {
      method: "POST",
      body: JSON.stringify({ model: "gpt-5.4-mini", stream: true }),
    })

    await expect(response.text()).resolves.toContain("response.completed")
    expect(streamCancelled).toBe(true)
  })

  it("clears locally stored credentials on sign out", async () => {
    await clearCodexOAuthAuth()
    expect(removeItemMock).toHaveBeenCalledWith("local:codexOAuthAuth")
  })
})
