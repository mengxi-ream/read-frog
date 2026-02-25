import type { EdgeTTSEndpointResponse, EdgeTTSTokenInfo } from "./types"
import {
  EDGE_TTS_CLIENT_VERSION,
  EDGE_TTS_DEFAULT_TOKEN_TTL_MS,
  EDGE_TTS_ENDPOINT_URL,
  EDGE_TTS_HOME_REGION,
  EDGE_TTS_TOKEN_REFRESH_BEFORE_EXPIRY_MS,
  EDGE_TTS_USER_AGENT,
  EDGE_TTS_USER_ID,
} from "./constants"
import { EdgeTTSError } from "./errors"
import { generateTranslatorSignature } from "./signature"

let tokenInfo: EdgeTTSTokenInfo | null = null

function decodeJwtExpiryMs(token: string): number | null {
  const [, payloadBase64 = ""] = token.split(".")
  if (!payloadBase64) {
    return null
  }

  try {
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    if (typeof payload.exp !== "number") {
      return null
    }
    return payload.exp * 1000
  }
  catch {
    return null
  }
}

function hasValidCachedToken(now = Date.now()): boolean {
  if (!tokenInfo) {
    return false
  }

  return now < (tokenInfo.expiredAt - EDGE_TTS_TOKEN_REFRESH_BEFORE_EXPIRY_MS)
}

function hasUnexpiredCachedToken(now = Date.now()): boolean {
  if (!tokenInfo) {
    return false
  }

  return now < tokenInfo.expiredAt
}

function ensureEndpointPayload(data: unknown): EdgeTTSEndpointResponse {
  if (!data || typeof data !== "object") {
    throw new EdgeTTSError("TOKEN_FETCH_FAILED", "Invalid endpoint response payload")
  }

  const endpoint = data as EdgeTTSEndpointResponse
  if (!endpoint.t || !endpoint.r || typeof endpoint.t !== "string" || typeof endpoint.r !== "string") {
    throw new EdgeTTSError("TOKEN_FETCH_FAILED", "Endpoint response is missing token or region")
  }

  return endpoint
}

export async function getEdgeTTSEndpointToken(): Promise<EdgeTTSTokenInfo> {
  if (hasValidCachedToken()) {
    return tokenInfo as EdgeTTSTokenInfo
  }

  try {
    const signature = await generateTranslatorSignature(EDGE_TTS_ENDPOINT_URL)
    const traceId = crypto.randomUUID().replace(/-/g, "")

    const response = await fetch(EDGE_TTS_ENDPOINT_URL, {
      method: "POST",
      headers: {
        "Accept-Language": "zh-Hans",
        "X-ClientVersion": EDGE_TTS_CLIENT_VERSION,
        "X-UserId": EDGE_TTS_USER_ID,
        "X-HomeGeographicRegion": EDGE_TTS_HOME_REGION,
        "X-ClientTraceId": traceId,
        "X-MT-Signature": signature,
        "User-Agent": EDGE_TTS_USER_AGENT,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: "",
    })

    if (!response.ok) {
      throw new EdgeTTSError("TOKEN_FETCH_FAILED", `Failed to fetch endpoint token: ${response.status}`, {
        status: response.status,
        retryable: response.status >= 500,
      })
    }

    const data = ensureEndpointPayload(await response.json())
    const expiry = decodeJwtExpiryMs(data.t) ?? (Date.now() + EDGE_TTS_DEFAULT_TOKEN_TTL_MS)

    tokenInfo = {
      endpoint: data,
      token: data.t,
      expiredAt: expiry,
    }

    return tokenInfo
  }
  catch (error) {
    if (hasUnexpiredCachedToken() && tokenInfo) {
      return tokenInfo
    }

    if (error instanceof EdgeTTSError) {
      throw error
    }

    throw new EdgeTTSError("TOKEN_FETCH_FAILED", "Failed to fetch Edge TTS endpoint token", {
      cause: error,
      retryable: true,
    })
  }
}

export function clearEdgeTTSTokenCache(): void {
  tokenInfo = null
}
