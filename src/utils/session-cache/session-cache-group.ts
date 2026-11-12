import type { ProxyResponse } from "@/types/proxy-fetch"
import { storage } from "#imports"
import { DEFAULT_PROXY_CACHE_TTL_MS } from "@/utils/constants/proxy-fetch"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("session-cache/session-cache-group")

interface CacheMetadata extends Record<string, unknown> {
  timestamp: number
}

type CachedItem = ProxyResponse

// TODO: solve race condition of cache group registry
export class SessionCache {
  private prefix: string
  private keysListKey: `session:${string}`
  private isInitialized = false

  constructor(groupKey: string = "default") {
    this.prefix = `cache_${groupKey}`
    this.keysListKey = `session:${this.prefix}__meta_keys` as const
  }

  private makeKey(reqMethod: string, targetUrl: string) {
    return `session:${this.prefix}_${reqMethod.toUpperCase()}_${targetUrl}` as const
  }

  private async ensureKeysListInitialized(): Promise<void> {
    if (this.isInitialized) return

    const existing = await storage.getItem<string[]>(this.keysListKey)
    if (existing === null) {
      await storage.setItem(this.keysListKey, [])
    }
    this.isInitialized = true
  }

  async get(
    reqMethod: string,
    targetUrl: string,
    ttl: number = DEFAULT_PROXY_CACHE_TTL_MS,
  ): Promise<ProxyResponse | undefined> {
    try {
      const key = this.makeKey(reqMethod, targetUrl)
      const [item, metadata] = await Promise.all([
        storage.getItem<CachedItem>(key),
        storage.getMeta<CacheMetadata>(key),
      ])

      if (!item || !metadata) {
        return undefined
      }

      if (Date.now() - metadata.timestamp > ttl) {
        await this.delete(reqMethod, targetUrl)
        return undefined
      }

      log.debug("Cache hit", { reqMethod, targetUrl })
      return item
    } catch (error) {
      log.error("Get error", { error })
      return undefined
    }
  }

  async set(reqMethod: string, targetUrl: string, response: ProxyResponse): Promise<void> {
    try {
      await this.ensureKeysListInitialized()

      const key = this.makeKey(reqMethod, targetUrl)
      const now = Date.now()

      // Set cache item and metadata in parallel
      await Promise.all([
        storage.setItem(key, response),
        storage.setMeta<CacheMetadata>(key, {
          timestamp: now,
        }),
      ])

      // Track this key for group clearing
      const keysList = (await storage.getItem<string[]>(this.keysListKey)) || []
      if (!keysList.includes(key)) {
        keysList.push(key)
        await storage.setItem(this.keysListKey, keysList)
      }

      log.debug("Cache set", { reqMethod, targetUrl })
    } catch (error) {
      log.error("Set error", { error })
    }
  }

  async delete(reqMethod: string, targetUrl: string): Promise<void> {
    try {
      await this.ensureKeysListInitialized()

      const key = this.makeKey(reqMethod, targetUrl)

      // Remove both data and metadata in parallel
      await Promise.all([storage.removeItem(key), storage.removeMeta(key)])

      // Remove from keys list
      const keysList = (await storage.getItem<string[]>(this.keysListKey)) || []
      const updatedKeysList = keysList.filter((k) => k !== key)
      await storage.setItem(this.keysListKey, updatedKeysList)
    } catch (error) {
      log.error("Delete error", { error })
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureKeysListInitialized()

      // Get all tracked keys for this group
      const keysList = (await storage.getItem<string[]>(this.keysListKey)) || []

      if (keysList.length > 0) {
        // Use bulk removal for better performance
        await storage.removeItems(
          keysList.map((key) => ({
            key: key as any,
            options: { removeMeta: true }, // Also remove metadata
          })),
        )
      }

      // Clear the keys list itself
      await storage.removeItem(this.keysListKey)
      this.isInitialized = false // Reset initialization flag

      log.debug("Cleared cache", { count: keysList.length })
    } catch (error) {
      log.error("Clear error", { error })
    }
  }
}
