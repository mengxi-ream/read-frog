import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { logger } from "@/utils/logger"

/**
 * In-memory config cache for content scripts.
 *
 * Loads config once on init, watches storage for changes,
 * and provides synchronous access via `getCachedConfig()`.
 * Zod validation runs only on load and on storage change — never in hot paths.
 */

let cachedConfig: Config | null = null
let initialized = false
const listeners: Array<(newConfig: Config, oldConfig: Config | null) => void> = []

function validateAndCache(raw: unknown): Config | null {
  if (!raw) {
    logger.warn("No config found in storage")
    return null
  }
  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    logger.error("Config is invalid, using default config")
    return DEFAULT_CONFIG
  }
  return parsed.data
}

/**
 * Initialize the config cache. Must be called once before using getCachedConfig().
 * Sets up a storage watcher to keep the cache in sync.
 */
export async function initConfigCache(): Promise<Config | null> {
  const raw = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  cachedConfig = validateAndCache(raw)
  initialized = true

  // Watch for storage changes and update cache
  storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newRaw) => {
    const oldConfig = cachedConfig
    cachedConfig = validateAndCache(newRaw)
    if (cachedConfig) {
      for (const listener of listeners) {
        listener(cachedConfig, oldConfig)
      }
    }
  })

  return cachedConfig
}

/**
 * Synchronous config access for hot paths (event handlers).
 * Returns cached config or DEFAULT_CONFIG if cache is not initialized.
 */
export function getCachedConfig(): Config {
  if (!initialized) {
    logger.warn("Config cache not initialized, returning default")
    return DEFAULT_CONFIG
  }
  return cachedConfig ?? DEFAULT_CONFIG
}

/**
 * Returns the raw cached config (may be null if no config in storage).
 */
export function getCachedConfigOrNull(): Config | null {
  return cachedConfig
}

/**
 * Register a listener for config changes.
 * Returns an unsubscribe function.
 */
export function onConfigChange(listener: (newConfig: Config, oldConfig: Config | null) => void): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx >= 0)
      listeners.splice(idx, 1)
  }
}
