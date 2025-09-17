import type { Config } from '@/types/config/config'
import { storage } from '#imports'
import { configSchema } from '@/types/config/config'
import { initializeConfig } from '@/utils/config/init'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { logger } from '@/utils/logger'
import { onMessage } from '@/utils/message'

let configPromise: Promise<void> | null = null

export async function ensureInitializedConfig() {
  if (!configPromise) {
    configPromise = initializeConfig()
  }
  await configPromise
  return storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
}

export function getConfigFromBackground() {
  onMessage('getInitialConfig', async () => {
    const config = await ensureInitializedConfig()
    if (!configSchema.safeParse(config).success) {
      console.error('Config is invalid. re-initializing config')
      logger.error('parse config error', configSchema.safeParse(config).error)
      await initializeConfig()
      return storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
    }
    return config
  })
}
