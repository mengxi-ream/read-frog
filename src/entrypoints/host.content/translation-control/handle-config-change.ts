import type { PageTranslationManager } from "./page-translation"
import type { Config } from "@/types/config/config"
import { dequal } from "dequal"
import { isTranslatedContentNode } from "@/utils/host/dom/filter"
import { deepQueryAllSelector } from "@/utils/host/dom/find"
import { decorateTranslationNode } from "@/utils/host/translate/ui/decorate-translation"

/**
 * Handles config changes and re-translates page when translation mode changes
 * while page translation is active.
 */
export function handleTranslationModeChange(
  newConfig: Config | null,
  oldConfig: Config | null,
  manager: PageTranslationManager,
): boolean {
  const modeChanged =
    newConfig && oldConfig && newConfig.translate.mode !== oldConfig.translate.mode

  if (modeChanged && manager.isActive) {
    manager.stop()
    void manager.start()
    return true
  }

  return false
}

/**
 * Re-decorates translations already present in the page when appearance
 * settings change, avoiding another translation request.
 */
export async function handleTranslationStyleChange(
  newConfig: Config | null,
  oldConfig: Config | null,
): Promise<void> {
  if (
    !newConfig ||
    !oldConfig ||
    dequal(newConfig.translate.translationNodeStyle, oldConfig.translate.translationNodeStyle)
  ) {
    return
  }

  const translatedNodes = deepQueryAllSelector(document, isTranslatedContentNode)
  await Promise.all(
    translatedNodes.map((node) =>
      decorateTranslationNode(node, newConfig.translate.translationNodeStyle),
    ),
  )
}
