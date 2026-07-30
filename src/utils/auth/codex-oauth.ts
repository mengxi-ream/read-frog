import { storage } from "#imports"

export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
export const CODEX_OAUTH_ISSUER = "https://auth.openai.com"
export const CODEX_OAUTH_DEVICE_URL = `${CODEX_OAUTH_ISSUER}/codex/device`
export const CODEX_API_BASE_URL = "https://chatgpt.com/backend-api/codex"

const CODEX_OAUTH_STORAGE_KEY = "local:codexOAuthAuth"
const CODEX_DEVICE_CODE_ENDPOINT = `${CODEX_OAUTH_ISSUER}/api/accounts/deviceauth/usercode`
const CODEX_DEVICE_TOKEN_ENDPOINT = `${CODEX_OAUTH_ISSUER}/api/accounts/deviceauth/token`
const CODEX_TOKEN_ENDPOINT = `${CODEX_OAUTH_ISSUER}/oauth/token`
const CODEX_DEVICE_REDIRECT_URI = `${CODEX_OAUTH_ISSUER}/deviceauth/callback`
const CODEX_DEVICE_TIMEOUT_MS = 10 * 60 * 1000
const CODEX_DEVICE_POLL_MARGIN_MS = 3_000
const CODEX_TOKEN_REFRESH_MARGIN_MS = 60_000

export interface CodexOAuthAuth {
  accessToken: string
  refreshToken: string
  expiresAt: number
  accountId: string
  email?: string
}

export interface CodexDeviceAuthorization {
  deviceAuthId: string
  userCode: string
  intervalMs: number
}

interface DeviceCodeResponse {
  device_auth_id: string
  user_code: string
  interval: string
}

interface DeviceTokenResponse {
  authorization_code: string
  code_verifier: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
}

interface IdTokenClaims {
  email?: string
  chatgpt_account_id?: string
  organizations?: Array<{ id?: string }>
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string
  }
}

interface CompleteDeviceAuthorizationOptions {
  fetchFn?: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
}

function getErrorStatusMessage(action: string, response: Response): string {
  return `${action} failed: HTTP ${response.status}`
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function parseCodexJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) return undefined

  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as IdTokenClaims
  } catch {
    return undefined
  }
}

function extractAccountId(claims: IdTokenClaims): string | undefined {
  return (
    claims.chatgpt_account_id ||
    claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

function parseInitialTokenResponse(tokens: TokenResponse): CodexOAuthAuth {
  if (!tokens.access_token || !tokens.refresh_token || !tokens.id_token || !tokens.expires_in) {
    throw new Error("Codex OAuth response is missing required tokens")
  }

  const claims = parseCodexJwtClaims(tokens.id_token)
  const accountId = claims && extractAccountId(claims)
  if (!accountId) {
    throw new Error("Codex OAuth response has no ChatGPT account id")
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    accountId,
    ...(claims.email ? { email: claims.email } : {}),
  }
}

async function exchangeAuthorizationCode(
  authorization: DeviceTokenResponse,
  fetchFn: typeof fetch,
): Promise<CodexOAuthAuth> {
  const response = await fetchFn(CODEX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authorization.authorization_code,
      redirect_uri: CODEX_DEVICE_REDIRECT_URI,
      client_id: CODEX_OAUTH_CLIENT_ID,
      code_verifier: authorization.code_verifier,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(getErrorStatusMessage("Codex token exchange", response))
  }

  return parseInitialTokenResponse((await response.json()) as TokenResponse)
}

export async function startCodexDeviceAuthorization(
  fetchFn: typeof fetch = fetch,
): Promise<CodexDeviceAuthorization> {
  const response = await fetchFn(CODEX_DEVICE_CODE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CODEX_OAUTH_CLIENT_ID }),
  })

  if (!response.ok) {
    throw new Error(getErrorStatusMessage("Codex device authorization", response))
  }

  const device = (await response.json()) as DeviceCodeResponse
  const intervalSeconds = Number.parseInt(device.interval, 10)
  if (!device.device_auth_id || !device.user_code || !Number.isFinite(intervalSeconds)) {
    throw new Error("Codex device authorization response is invalid")
  }

  return {
    deviceAuthId: device.device_auth_id,
    userCode: device.user_code,
    intervalMs: Math.max(intervalSeconds, 1) * 1000,
  }
}

function waitForNextPoll(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Codex sign-in cancelled", "AbortError"))
      return
    }

    const handleAbort = () => {
      clearTimeout(timeout)
      reject(signal?.reason ?? new DOMException("Codex sign-in cancelled", "AbortError"))
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener("abort", handleAbort, { once: true })
  })
}

export async function completeCodexDeviceAuthorization(
  device: CodexDeviceAuthorization,
  options: CompleteDeviceAuthorizationOptions = {},
): Promise<CodexOAuthAuth> {
  const fetchFn = options.fetchFn ?? fetch
  const timeoutMs = options.timeoutMs ?? CODEX_DEVICE_TIMEOUT_MS
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetchFn(CODEX_DEVICE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_auth_id: device.deviceAuthId,
        user_code: device.userCode,
      }),
      signal: options.signal,
    })

    if (response.ok) {
      const auth = await exchangeAuthorizationCode(
        (await response.json()) as DeviceTokenResponse,
        fetchFn,
      )
      await storage.setItem(CODEX_OAUTH_STORAGE_KEY, auth)
      return auth
    }

    if (response.status !== 403 && response.status !== 404) {
      throw new Error(getErrorStatusMessage("Codex device authorization", response))
    }

    await waitForNextPoll(device.intervalMs + CODEX_DEVICE_POLL_MARGIN_MS, options.signal)
  }

  throw new Error("Codex device authorization timed out")
}

export async function getCodexOAuthAuth(): Promise<CodexOAuthAuth | null> {
  return (await storage.getItem<CodexOAuthAuth>(CODEX_OAUTH_STORAGE_KEY)) ?? null
}

export async function clearCodexOAuthAuth(): Promise<void> {
  await storage.removeItem(CODEX_OAUTH_STORAGE_KEY)
}

async function refreshCodexOAuthAuth(
  current: CodexOAuthAuth,
  fetchFn: typeof fetch,
): Promise<CodexOAuthAuth> {
  const response = await fetchFn(CODEX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: CODEX_OAUTH_CLIENT_ID,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(getErrorStatusMessage("Codex token refresh", response))
  }

  const tokens = (await response.json()) as TokenResponse
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
    throw new Error("Codex token refresh response is missing required tokens")
  }

  const next: CodexOAuthAuth = {
    ...current,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }
  const latest = await getCodexOAuthAuth()
  if (!latest || latest.refreshToken !== current.refreshToken) {
    throw new Error("Codex OAuth session changed during token refresh")
  }
  await storage.setItem(CODEX_OAUTH_STORAGE_KEY, next)
  return next
}

let refreshPromise: Promise<CodexOAuthAuth> | undefined

interface CodexOutputItemDoneEvent {
  type: "response.output_item.done"
  item: Record<string, unknown>
  output_index?: number
}

function getCodexEventData(block: string): string | undefined {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
  return data || undefined
}

function parseCodexEventBlock(block: string): Record<string, unknown> | undefined {
  const data = getCodexEventData(block)
  if (!data || data === "[DONE]") return undefined

  const event = JSON.parse(data) as unknown
  return event && typeof event === "object" && !Array.isArray(event)
    ? (event as Record<string, unknown>)
    : undefined
}

function getCodexCompletedResponse(
  event: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (
    (event?.type === "response.completed" || event?.type === "response.incomplete") &&
    "response" in event &&
    event.response &&
    typeof event.response === "object" &&
    !Array.isArray(event.response)
  ) {
    return event.response as Record<string, unknown>
  }

  return undefined
}

function isCodexTerminalEventBlock(block: string): boolean {
  const data = getCodexEventData(block)
  if (!data) return false
  if (data === "[DONE]") return true

  const event = JSON.parse(data) as { type?: unknown }
  return (
    event.type === "response.completed" ||
    event.type === "response.incomplete" ||
    event.type === "response.failed" ||
    event.type === "error"
  )
}

async function readCodexCompletedResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.body) {
    throw new Error("Codex streaming response has no body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const outputItems: Array<Record<string, unknown> | undefined> = []

  const collectOutputItem = (event: Record<string, unknown> | undefined) => {
    if (event?.type !== "response.output_item.done") return
    const { item, output_index: outputIndex } = event as Partial<CodexOutputItemDoneEvent>
    if (!item || typeof item !== "object" || Array.isArray(item)) return

    if (Number.isInteger(outputIndex) && outputIndex! >= 0) {
      outputItems[outputIndex!] = item
    } else {
      outputItems.push(item)
    }
  }

  const completeResponse = (
    event: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined => {
    const completedResponse = getCodexCompletedResponse(event)
    if (!completedResponse) return undefined

    const streamedOutput = outputItems.filter(
      (item): item is Record<string, unknown> => item !== undefined,
    )
    return streamedOutput.length > 0
      ? { ...completedResponse, output: streamedOutput }
      : completedResponse
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })

      while (true) {
        const separator = /\r?\n\r?\n/.exec(buffer)
        if (!separator) break

        const block = buffer.slice(0, separator.index)
        buffer = buffer.slice(separator.index + separator[0].length)
        const event = parseCodexEventBlock(block)
        collectOutputItem(event)
        const completedResponse = completeResponse(event)
        if (completedResponse) return completedResponse
      }

      if (done) {
        const event = parseCodexEventBlock(buffer)
        collectOutputItem(event)
        const completedResponse = completeResponse(event)
        if (completedResponse) return completedResponse
        throw new Error("Codex stream ended without a completed response")
      }
    }
  } finally {
    // The terminal SSE event already contains the complete response. Browser
    // fetch streams may keep the cancellation promise pending while the
    // underlying HTTP connection is being torn down, so waiting here can
    // prevent the completed response from ever reaching the AI SDK.
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

async function convertCodexStreamToJson(response: Response): Promise<Response> {
  if (!response.ok) return response

  const completedResponse = await readCodexCompletedResponse(response)
  const headers = new Headers(response.headers)
  headers.set("Content-Type", "application/json")
  headers.delete("Content-Length")
  headers.delete("Content-Encoding")
  return new Response(JSON.stringify(completedResponse), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function closeCodexStreamAtTerminalEvent(response: Response): Response {
  if (!response.body) return response
  const isEventStream = response.headers.get("Content-Type")?.includes("text/event-stream")
  if (!isEventStream) return response
  const reader = response.body.getReader()

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ""
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const separator = /\r?\n\r?\n/.exec(buffer)
          if (separator) {
            const eventEnd = separator.index + separator[0].length
            const block = buffer.slice(0, separator.index)
            const eventBytes = encoder.encode(buffer.slice(0, eventEnd))
            buffer = buffer.slice(eventEnd)
            controller.enqueue(eventBytes)

            if (isCodexTerminalEventBlock(block)) {
              // Close the consumer-facing stream immediately on a terminal
              // event; do not couple completion to transport teardown.
              void reader.cancel().catch(() => undefined)
              controller.close()
            }
            return
          }

          const result = await reader.read()
          if (result.done) {
            buffer += decoder.decode()
            if (buffer) controller.enqueue(encoder.encode(buffer))
            controller.close()
            return
          }
          buffer += decoder.decode(result.value, { stream: true })
        }
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel(reason) {
      await reader.cancel(reason)
    },
  })

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export async function getValidCodexOAuthAuth(
  fetchFn: typeof fetch = fetch,
): Promise<CodexOAuthAuth> {
  const current = await getCodexOAuthAuth()
  if (!current) {
    throw new Error("Not signed in to Codex")
  }

  if (current.expiresAt > Date.now() + CODEX_TOKEN_REFRESH_MARGIN_MS) {
    return current
  }

  refreshPromise ??= refreshCodexOAuthAuth(current, fetchFn).finally(() => {
    refreshPromise = undefined
  })
  return refreshPromise
}

export async function codexOAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let request = new Request(input, init)
  const requestUrl = new URL(request.url)
  const allowedBase = new URL(CODEX_API_BASE_URL)
  if (
    requestUrl.origin !== allowedBase.origin ||
    !requestUrl.pathname.startsWith(`${allowedBase.pathname}/`)
  ) {
    throw new Error("Refusing to send Codex OAuth credentials to an unexpected endpoint")
  }

  let convertStreamingResponseToJson = false
  if (requestUrl.pathname === `${allowedBase.pathname}/responses`) {
    const payload = (await request.clone().json()) as unknown
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Codex Responses request body must be a JSON object")
    }
    convertStreamingResponseToJson = (payload as Record<string, unknown>).stream !== true
    request = new Request(request, {
      body: JSON.stringify({ ...payload, store: false, stream: true }),
    })
  }

  const auth = await getValidCodexOAuthAuth()
  const headers = new Headers(request.headers)
  headers.set("Authorization", `Bearer ${auth.accessToken}`)
  headers.set("ChatGPT-Account-Id", auth.accountId)
  headers.set("originator", "read-frog")

  const authenticatedRequest = new Request(request, { headers })
  const response = await fetch(authenticatedRequest)
  return convertStreamingResponseToJson && response.ok
    ? convertCodexStreamToJson(response)
    : closeCodexStreamAtTerminalEvent(response)
}
