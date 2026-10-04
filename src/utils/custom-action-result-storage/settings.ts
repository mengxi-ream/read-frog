import type { CustomActionResultStorageSettings } from "./types"
import { storage } from "#imports"
import {
  customActionResultStorageSettingsSchema,
  DEFAULT_CUSTOM_ACTION_RESULT_STORAGE_SETTINGS,
} from "./types"

export const CUSTOM_ACTION_RESULT_STORAGE_KEY = "customActionResultStorageSettings"

/**
 * These settings intentionally live in extension storage.local. In particular,
 * the WebDAV password must never be included in the synced Config object.
 */
export async function getCustomActionResultStorageSettings(): Promise<CustomActionResultStorageSettings> {
  const value = await storage.getItem<unknown>(`local:${CUSTOM_ACTION_RESULT_STORAGE_KEY}`)
  const parsed = customActionResultStorageSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_CUSTOM_ACTION_RESULT_STORAGE_SETTINGS
}

export async function setCustomActionResultStorageSettings(
  value: CustomActionResultStorageSettings,
): Promise<void> {
  const parsed = customActionResultStorageSettingsSchema.parse(value)
  await storage.setItem(`local:${CUSTOM_ACTION_RESULT_STORAGE_KEY}`, parsed)
}

export function watchCustomActionResultStorageSettings(
  callback: (settings: CustomActionResultStorageSettings) => void,
): () => void {
  return storage.watch<unknown>(`local:${CUSTOM_ACTION_RESULT_STORAGE_KEY}`, (value) => {
    const parsed = customActionResultStorageSettingsSchema.safeParse(value)
    callback(parsed.success ? parsed.data : DEFAULT_CUSTOM_ACTION_RESULT_STORAGE_SETTINGS)
  })
}
