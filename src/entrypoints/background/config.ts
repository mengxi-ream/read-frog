import type { Config } from "@/types/config/config"
import type { InitializeConfigResult } from "@/utils/config/init"
import { storage } from "#imports"
import { initializeConfig } from "@/utils/config/init"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"

let configPromise: Promise<InitializeConfigResult> | null = null

// To avoid background script initialize config simultaneously and avoid race condition
export async function ensureInitializedConfig() {
  if (!configPromise) {
    configPromise = initializeConfig()
  }
  await configPromise
  return storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
}

/**
 * Whether the config was created from defaults in this run, rather than loaded from storage.
 * Shares the memoized initialization above, so it never triggers a second init.
 */
export async function isFreshInstalledConfig() {
  if (!configPromise) {
    configPromise = initializeConfig()
  }
  return (await configPromise).isFreshInstall
}
