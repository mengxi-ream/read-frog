import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { TranslationMode } from "@/types/config/translate"
import { storage } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { getDetectedCodeStateKey } from "@/utils/constants/storage-keys"

export interface PageAnalyticsContext {
  page_language?: LangCodeISO6393
  translation_mode?: TranslationMode
}

/**
 * Coarse page-translation context for analytics: the tab's detected page
 * language (already computed for auto-translation) and the configured
 * translation mode. Missing values are omitted rather than defaulted, so an
 * undetected page is not reported as the fallback language.
 */
export async function getPageAnalyticsContext(tabId: number): Promise<PageAnalyticsContext> {
  const [detectedCode, config] = await Promise.all([
    storage.getItem<LangCodeISO6393>(getDetectedCodeStateKey(tabId)),
    getLocalConfig(),
  ])

  return {
    ...(typeof detectedCode === "string" ? { page_language: detectedCode } : {}),
    ...(config?.pageTranslation.mode ? { translation_mode: config.pageTranslation.mode } : {}),
  }
}
