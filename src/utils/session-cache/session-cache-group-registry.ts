import { storage } from "#imports"
import { createLogger } from "@/utils/logging/logger"
import { SessionCache } from "./session-cache-group"

const log = createLogger("session-cache/session-cache-group-registry")

// TODO: solve race condition of cache group registry
const REGISTRY_KEY = "session:__system_cache_registry" as const

export const SessionCacheGroupRegistry = {
  async registerCacheGroup(groupKey: string): Promise<void> {
    try {
      const registry = await SessionCacheGroupRegistry.getAllCacheGroup()
      if (!registry.includes(groupKey)) {
        registry.push(groupKey)
        await storage.setItem(REGISTRY_KEY, registry)
        log.debug("Registered group", { groupKey })
      }
    } catch (error) {
      log.error("Failed to register group", { error })
    }
  },

  async getAllCacheGroup(): Promise<string[]> {
    try {
      return (await storage.getItem<string[]>(REGISTRY_KEY)) || []
    } catch (error) {
      log.error("Failed to get registry", { error })
      return []
    }
  },

  async getCacheGroup(groupKey: string): Promise<SessionCache> {
    await SessionCacheGroupRegistry.registerCacheGroup(groupKey)
    return new SessionCache(groupKey)
  },

  async clearAllCacheGroup(): Promise<void> {
    try {
      const registry = await SessionCacheGroupRegistry.getAllCacheGroup()
      log.debug("Clearing all cache groups", { registry })

      // Clear each group
      const clearPromises = registry.map(async (groupKey) => {
        const cache = new SessionCache(groupKey)
        await cache.clear()
        log.debug("Cleared cache group", { groupKey })
      })

      await Promise.all(clearPromises)

      // Clear the registry itself
      await storage.removeItem(REGISTRY_KEY)
      log.debug("All caches cleared")
    } catch (error) {
      log.error("Failed to clear all caches", { error })
    }
  },

  async removeCacheGroup(groupKey: string): Promise<void> {
    try {
      // First clear the cache data
      const cache = new SessionCache(groupKey)
      await cache.clear()

      const registry = await SessionCacheGroupRegistry.getAllCacheGroup()
      const updatedRegistry = registry.filter((key) => key !== groupKey)
      await storage.setItem(REGISTRY_KEY, updatedRegistry)

      log.debug("Removed group completely", { groupKey })
    } catch (error) {
      log.error("Failed to remove group", { error })
    }
  },
}
