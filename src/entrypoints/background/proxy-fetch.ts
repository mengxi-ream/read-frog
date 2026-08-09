import type { ProxyResponse } from "@/types/proxy-fetch"
import { AUTH_COOKIE_PATTERNS } from "@read-frog/definitions"
import { browser, storage } from "#imports"
import { env } from "@/env"
import { AUTH_CACHE_GROUP_KEY, DEFAULT_PROXY_CACHE_TTL_MS } from "@/utils/constants/proxy-fetch"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { SessionCacheGroupRegistry } from "../../utils/session-cache/session-cache-group-registry"

// Last-seen auth cookie values, kept in session storage so the comparison
// survives service-worker restarts (cleared with the browser session)
const AUTH_COOKIE_LAST_SEEN_KEY = "session:proxyFetchAuthCookieLastSeen"

function encodeArrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function proxyFetch() {
  // Simplified: No need for in-memory Map, CacheRegistry handles everything
  async function getSessionCache(groupKey: string) {
    return await SessionCacheGroupRegistry.getCacheGroup(groupKey)
  }

  // Global cache invalidation function
  async function invalidateAllCache() {
    logger.info("[ProxyFetch] Invalidating all cache")
    await SessionCacheGroupRegistry.clearAllCacheGroup()
  }

  // Auth-scoped cache invalidation: session cookie changes only affect the auth group
  async function invalidateAuthCache() {
    const sessionCache = await getSessionCache(AUTH_CACHE_GROUP_KEY)
    await sessionCache.clear()
  }

  // Listen for cookie changes to invalidate auth-related cache
  if (browser.cookies?.onChanged) {
    browser.cookies.onChanged.addListener(async (changeInfo) => {
      const { cookie, removed, cause } = changeInfo
      // Check if it's an auth-related cookie for monitored domains
      if (
        !cookie.domain ||
        !env.WXT_AUTH_COOKIE_DOMAINS.some((domain: string) => cookie.domain.includes(domain))
      ) {
        return
      }
      // Check against defined auth cookie patterns
      if (!AUTH_COOKIE_PATTERNS.some((name) => cookie.name.includes(name))) {
        return
      }

      // A cookie re-set fires two events: an "overwrite" removal followed by an
      // add. Only the add carries the new value, so skip the overwrite half —
      // otherwise every server-side cookie refresh double-invalidates the cache.
      if (removed && cause === "overwrite") {
        return
      }

      const lastSeenKey = `${cookie.domain}|${cookie.name}`
      const newValue = removed ? undefined : cookie.value

      try {
        const lastSeen =
          (await storage.getItem<Record<string, string>>(AUTH_COOKIE_LAST_SEEN_KEY)) ?? {}
        // Same token re-issued (e.g. expiry extended): session identity didn't
        // change, so the cached session is still valid — don't invalidate, or
        // every get-session response would evict the cache it just filled.
        if (!removed && lastSeen[lastSeenKey] === newValue) {
          return
        }
        if (newValue === undefined) {
          delete lastSeen[lastSeenKey]
        } else {
          lastSeen[lastSeenKey] = newValue
        }
        await storage.setItem(AUTH_COOKIE_LAST_SEEN_KEY, lastSeen)
      } catch (error) {
        // Can't tell whether the token changed — invalidate to stay correct
        logger.warn("[ProxyFetch] Could not read last-seen auth cookie state:", error)
      }

      logger.info("[ProxyFetch] Auth cookie changed, invalidating auth cache:", {
        cookieName: cookie.name,
        domain: cookie.domain,
        removed,
        cause,
      })
      invalidateAuthCache().catch((error) =>
        logger.error("[ProxyFetch] Failed to invalidate auth cache:", error),
      )
    })
  }

  // Proxy cross-origin fetches for content scripts and other contexts
  onMessage("backgroundFetch", async (message): Promise<ProxyResponse> => {
    logger.info("[ProxyFetch] Background fetch:", message.data)

    const {
      url,
      method,
      headers,
      body,
      credentials,
      redirect,
      cacheConfig,
      responseType = "text",
    } = message.data

    const {
      enabled: cacheEnabled = false,
      groupKey: cacheGroupKey = "default",
      ttl: cacheTtl = DEFAULT_PROXY_CACHE_TTL_MS,
    } = cacheConfig ?? {}

    async function getCached(
      reqMethod: string,
      targetUrl: string,
    ): Promise<ProxyResponse | undefined> {
      if (!cacheEnabled) return undefined

      const sessionCache = await getSessionCache(cacheGroupKey)
      return await sessionCache.get(reqMethod, targetUrl, cacheTtl)
    }

    async function setCached(
      reqMethod: string,
      targetUrl: string,
      resp: ProxyResponse,
    ): Promise<void> {
      if (!cacheEnabled) return

      const sessionCache = await getSessionCache(cacheGroupKey)
      await sessionCache.set(reqMethod, targetUrl, resp)
    }

    async function invalidateCache(groupKey?: string): Promise<void> {
      logger.info("[ProxyFetch] Invalidate cache:", { groupKey })
      if (groupKey) {
        const sessionCache = await getSessionCache(groupKey)
        await sessionCache.clear()
      } else {
        await invalidateAllCache()
      }
    }

    const finalMethod = (method ?? "GET").toUpperCase()

    // Check cache for GET requests
    if (finalMethod === "GET" && cacheEnabled) {
      const cached = await getCached(finalMethod, url)
      if (cached) return cached
    }

    // Aggressive mode: pre-clear cache before mutations to avoid race with subsequent GETs
    if (finalMethod !== "GET") {
      await invalidateCache(cacheGroupKey)
    }

    const response = await fetch(url, {
      method: finalMethod,
      headers: headers ? new Headers(headers) : undefined,
      body,
      credentials: credentials ?? "include",
      redirect,
    })

    const responseHeaders: [string, string][] = [...response.headers.entries()]
    const responseBody =
      responseType === "base64"
        ? encodeArrayBufferToBase64(await response.arrayBuffer())
        : await response.text()

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      bodyEncoding: responseType,
    }

    logger.info("[ProxyFetch] Response without cache:", result)

    // Handle caching based on response
    if (cacheEnabled) {
      if (finalMethod === "GET") {
        // For auth requests: 401/403 implies session invalid -> clear cache
        if (result.status === 401 || result.status === 403) {
          await invalidateCache(cacheGroupKey)
        }
        // Only cache successful GET responses
        else if (result.status >= 200 && result.status < 300) {
          await setCached(finalMethod, url, result)
        }
      } else {
        // For auth mutations: only invalidate cache if mutation succeeded
        if (result.status >= 200 && result.status < 300) {
          await invalidateCache(cacheGroupKey)
        }
      }
    }

    return result
  })
}
