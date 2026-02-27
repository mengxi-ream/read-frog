import { storage } from "#imports"
import { logger } from "@/utils/logger"
import { SessionCache } from "./session-cache-group"

// TODO: solve race condition of cache group registry
export class SessionCacheGroupRegistry {
  private static readonly REGISTRY_KEY = "session:__system_cache_registry" as const

  static async registerCacheGroup(groupKey: string): Promise<void> {
    try {
      const registry = await this.getAllCacheGroup()
      if (!registry.includes(groupKey)) {
        registry.push(groupKey)
        await storage.setItem(this.REGISTRY_KEY, registry)
        logger.info("[CacheRegistry] Registered group:", groupKey)
      }
    }
    catch (error) {
      logger.error("[CacheRegistry] Failed to register group:", error)
    }
  }

  static async getAllCacheGroup(): Promise<string[]> {
    try {
      return await storage.getItem<string[]>(this.REGISTRY_KEY) || []
    }
    catch (error) {
      logger.error("[CacheRegistry] Failed to get registry:", error)
      return []
    }
  }

  static async getCacheGroup(groupKey: string): Promise<SessionCache> {
    await this.registerCacheGroup(groupKey)
    return new SessionCache(groupKey)
  }

  static async clearAllCacheGroup(): Promise<void> {
    try {
      const registry = await this.getAllCacheGroup()
      logger.info("[CacheRegistry] Clearing all cache groups:", registry)

      // Clear each group
      const clearPromises = registry.map(async (groupKey) => {
        const cache = new SessionCache(groupKey)
        await cache.clear()
        logger.info("[CacheRegistry] Cleared cache group:", groupKey)
      })

      await Promise.all(clearPromises)

      // Clear the registry itself
      await storage.removeItem(this.REGISTRY_KEY)
      logger.info("[CacheRegistry] All caches cleared")
    }
    catch (error) {
      logger.error("[CacheRegistry] Failed to clear all caches:", error)
    }
  }

  static async removeCacheGroup(groupKey: string): Promise<void> {
    try {
      // First clear the cache data
      const cache = new SessionCache(groupKey)
      await cache.clear()

      const registry = await this.getAllCacheGroup()
      const updatedRegistry = registry.filter(key => key !== groupKey)
      await storage.setItem(this.REGISTRY_KEY, updatedRegistry)

      logger.info("[CacheRegistry] Removed group completely:", groupKey)
    }
    catch (error) {
      logger.error("[CacheRegistry] Failed to remove group:", error)
    }
  }
}
