import type { TranslationState } from "@/types/translation-state"
import { storage } from "#imports"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"
import { getPageTranslationOriginScope } from "@/utils/url"

export async function getPageTranslationState(tabId: number): Promise<TranslationState | null> {
  return await storage.getItem<TranslationState>(
    getTranslationStateKey(tabId),
  )
}

export async function getPageTranslationEnabled(tabId: number): Promise<boolean> {
  const state = await getPageTranslationState(tabId)
  return state?.enabled ?? false
}

export async function setPageTranslationEnabled(tabId: number, enabled: boolean, url?: string): Promise<void> {
  const origin = enabled && url ? getPageTranslationOriginScope(url) : null

  await storage.setItem<TranslationState>(
    getTranslationStateKey(tabId),
    origin ? { enabled, origin } : { enabled },
  )
}

export function isPageTranslationStateInUrlScope(state: TranslationState | null | undefined, url: string | undefined): boolean {
  if (!state?.enabled || !state.origin || !url)
    return false

  return state.origin === getPageTranslationOriginScope(url)
}
