import type { PageTranslationManager } from "./page-translation"
import type { Config } from "@/types/config/config"
import type { TranslationNodeStyleConfig } from "@/types/config/translate"
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
): void {
  const modeChanged =
    newConfig && oldConfig && newConfig.translate.mode !== oldConfig.translate.mode

  if (modeChanged && manager.isActive) {
    manager.stop()
    void manager.start()
  }
}

/**
 * Re-decorates translations already present in the page when appearance
 * settings change, avoiding another translation request.
 */
export async function handleTranslationStyleChange(
  translationNodeStyle: TranslationNodeStyleConfig,
): Promise<void> {
  const translatedNodes = deepQueryAllSelector(document, isTranslatedContentNode)
  // Custom stylesheets are shared per document/shadow root. Decorate
  // sequentially so multiple nodes cannot call CSSStyleSheet.replace()
  // concurrently on the same sheet.
  for (const node of translatedNodes) {
    await decorateTranslationNode(node, translationNodeStyle)
  }
}
