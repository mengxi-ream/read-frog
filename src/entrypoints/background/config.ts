import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { initializeConfig } from "@/utils/config/init"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"

let configPromise: Promise<void> | null = null

// To avoid background script initialize config simultaneously and avoid race condition
export async function ensureInitializedConfig() {
  if (!configPromise) {
    configPromise = initializeConfig()
  }
  await configPromise
  return storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
}
