import type { Config } from "@/types/config/config"
import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import { dequal } from "dequal"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { getLocalConfig } from "@/utils/config/storage"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import {
  clearLiveTranslationNodeStyle,
  setLiveTranslationNodeStyle,
} from "@/utils/host/translate/ui/live-translation-style"
import { logger } from "@/utils/logger"
import { handleTranslationStyleChange } from "./handle-config-change"

/**
 * Watches translation appearance only for the lifetime of an active page
 * translation session.
 */
export function registerTranslationStyleListener(
  initialStyle: TranslationNodeStyleConfig,
): () => void {
  let currentStyle = initialStyle
  let disposed = false
  let styleUpdateQueue = Promise.resolve()
  setLiveTranslationNodeStyle(currentStyle)

  const queueStyleUpdate = (nextStyle: TranslationNodeStyleConfig): void => {
    if (disposed || dequal(nextStyle, currentStyle)) return

    currentStyle = nextStyle
    setLiveTranslationNodeStyle(nextStyle)
    styleUpdateQueue = styleUpdateQueue
      .then(async () => {
        if (!disposed) await handleTranslationStyleChange(nextStyle)
      })
      .catch((error) => {
        logger.warn("Failed to update live translation styles", error)
      })
  }

  const unwatch = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, (newConfig) => {
    queueStyleUpdate(newConfig.translate.translationNodeStyle)
  })

  const reconcileVisibleStyle = (): void => {
    if (document.visibilityState !== "visible") return

    void getLocalConfig()
      .then((config) => {
        if (config) queueStyleUpdate(config.translate.translationNodeStyle)
      })
      .catch((error) => {
        logger.warn("Failed to reconcile live translation styles", error)
      })
  }
  document.addEventListener("visibilitychange", reconcileVisibleStyle)

  return () => {
    disposed = true
    unwatch()
    document.removeEventListener("visibilitychange", reconcileVisibleStyle)
    clearLiveTranslationNodeStyle()
  }
}
