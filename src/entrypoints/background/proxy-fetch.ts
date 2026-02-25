import type { ProxyResponse } from "@/types/proxy-fetch"
import { browser } from "#imports"
import { AUTH_COOKIE_PATTERNS, AUTH_DOMAINS } from "@read-frog/definitions"
import { DEFAULT_PROXY_CACHE_TTL_MS } from "@/utils/constants/proxy-fetch"

import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { SessionCacheGroupRegistry } from "../../utils/session-cache/session-cache-group-registry"

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

  // Listen for cookie changes to invalidate auth-related cache
  if (browser.cookies && browser.cookies.onChanged) {
    browser.cookies.onChanged.addListener(async (changeInfo) => {
      const { cookie, removed } = changeInfo
      // Check if it's an auth-related cookie for monitored domains
      if (cookie.domain && AUTH_DOMAINS.some(domain => cookie.domain.includes(domain))) {
        // Check against defined auth cookie patterns
        if (AUTH_COOKIE_PATTERNS.some(name => cookie.name.includes(name))) {
          // Get current cookie value for before/after comparison
          let beforeValue: string | undefined
          let afterValue: string | undefined

          if (removed) {
            // Cookie was removed - before value was the cookie value, after is undefined
            beforeValue = cookie.value
            afterValue = undefined
          }
          else {
            // Cookie was added/updated - get the previous value by querying all cookies
            try {
              const existingCookies = await browser.cookies.getAll({
                domain: cookie.domain,
                name: cookie.name,
              })
              // If cookie exists, this was an update; if not, this was creation
              beforeValue = existingCookies.length > 0 && existingCookies[0].value !== cookie.value
                ? existingCookies[0].value
                : undefined
              afterValue = cookie.value
            }
            catch (error) {
              logger.warn("[ProxyFetch] Could not retrieve previous cookie value:", error)
              beforeValue = "unknown"
              afterValue = cookie.value
            }
          }

          logger.info("[ProxyFetch] Auth cookie changed, invalidating cache:", {
            cookieName: cookie.name,
            domain: cookie.domain,
            removed,
            beforeValue,
            afterValue,
          })
          invalidateAllCache().catch(error =>
            logger.error("[ProxyFetch] Failed to invalidate cache:", error),
          )
        }
      }
    })
  }

  // Proxy cross-origin fetches for content scripts and other contexts
  onMessage("backgroundFetch", async (message): Promise<ProxyResponse> => {
    logger.info("[ProxyFetch] Background fetch:", message.data)

    const { url, method, headers, body, credentials, cacheConfig } = message.data

    const {
      enabled: cacheEnabled = false,
      groupKey: cacheGroupKey = "default",
      ttl: cacheTtl = DEFAULT_PROXY_CACHE_TTL_MS,
    } = cacheConfig ?? {}

    async function getCached(reqMethod: string, targetUrl: string): Promise<ProxyResponse | undefined> {
      if (!cacheEnabled)
        return undefined

      const sessionCache = await getSessionCache(cacheGroupKey)
      return await sessionCache.get(reqMethod, targetUrl, cacheTtl)
    }

    async function setCached(reqMethod: string, targetUrl: string, resp: ProxyResponse): Promise<void> {
      if (!cacheEnabled)
        return

      const sessionCache = await getSessionCache(cacheGroupKey)
      await sessionCache.set(reqMethod, targetUrl, resp)
    }

    async function invalidateCache(groupKey?: string): Promise<void> {
      logger.info("[ProxyFetch] Invalidate cache:", { groupKey })
      if (groupKey) {
        const sessionCache = await getSessionCache(groupKey)
        await sessionCache.clear()
      }
      else {
        await invalidateAllCache()
      }
    }

    const finalMethod = (method ?? "GET").toUpperCase()

    // Check cache for GET requests
    if (finalMethod === "GET" && cacheEnabled) {
      const cached = await getCached(finalMethod, url)
      if (cached)
        return cached
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
    })

    const responseHeaders: [string, string][] = Array.from(response.headers.entries())
    const textBody = await response.text()

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: textBody,
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
      }
      else {
        // For auth mutations: only invalidate cache if mutation succeeded
        if (result.status >= 200 && result.status < 300) {
          await invalidateCache(cacheGroupKey)
        }
      }
    }

    return result
  })
}
