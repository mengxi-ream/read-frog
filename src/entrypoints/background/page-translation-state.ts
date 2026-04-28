import type { TranslationState } from "@/types/translation-state"
import { storage } from "#imports"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"

export async function getPageTranslationEnabled(tabId: number): Promise<boolean> {
  const state = await storage.getItem<TranslationState>(
    getTranslationStateKey(tabId),
  )
  return state?.enabled ?? false
}

export async function setPageTranslationEnabled(tabId: number, enabled: boolean): Promise<void> {
  await storage.setItem<TranslationState>(
    getTranslationStateKey(tabId),
    { enabled },
  )
}
