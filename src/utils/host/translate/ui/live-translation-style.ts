import type { TranslationNodeStyleConfig } from "@/types/config/translate"

let liveTranslationNodeStyle: TranslationNodeStyleConfig | null = null

export function setLiveTranslationNodeStyle(style: TranslationNodeStyleConfig): void {
  liveTranslationNodeStyle = style
}

export function clearLiveTranslationNodeStyle(): void {
  liveTranslationNodeStyle = null
}

export function resolveLiveTranslationNodeStyle(
  fallback: TranslationNodeStyleConfig,
): TranslationNodeStyleConfig {
  return liveTranslationNodeStyle ?? fallback
}
