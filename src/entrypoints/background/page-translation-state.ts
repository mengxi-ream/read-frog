import type { TranslationState } from "@/types/translation-state"
import { storage } from "#imports"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"
import { getPageTranslationOriginScope } from "@/utils/url"

export async function getPageTranslationState(tabId: number): Promise<TranslationState | null> {
  return await storage.getItem<TranslationState>(getTranslationStateKey(tabId))
}

export async function getPageTranslationEnabled(tabId: number): Promise<boolean> {
  const state = await getPageTranslationState(tabId)
  return state?.enabled ?? false
}

export async function setPageTranslationEnabled(
  tabId: number,
  enabled: boolean,
  url?: string,
  userInitiated?: boolean,
): Promise<void> {
  if (enabled) {
    const origin = url ? getPageTranslationOriginScope(url) : null

    await storage.setItem<TranslationState>(
      getTranslationStateKey(tabId),
      origin ? { enabled, origin } : { enabled },
    )
    return
  }

  // A user-initiated disable is remembered with the origin it was rejected
  // on, so auto-translation cannot force the page back on until the tab
  // leaves that origin. Origin-less URLs (file://, chrome://) cannot be
  // scoped and fall back to a bare disable. Always a full replace-write:
  // message handlers are not serialized, so read-modify-write here would race.
  const origin = userInitiated && url ? getPageTranslationOriginScope(url) : null

  await storage.setItem<TranslationState>(
    getTranslationStateKey(tabId),
    origin ? { enabled: false, userDisabled: true, origin } : { enabled: false },
  )
}

export function isPageTranslationStateInUrlScope(
  state: TranslationState | null | undefined,
  url: string | undefined,
): boolean {
  if (!state?.enabled || !state.origin || !url) return false

  return state.origin === getPageTranslationOriginScope(url)
}

export function isAutoTranslationSuppressed(
  state: TranslationState | null | undefined,
  url: string | undefined,
): boolean {
  if (!state || state.enabled || state.userDisabled !== true || !state.origin || !url) return false

  return state.origin === getPageTranslationOriginScope(url)
}
