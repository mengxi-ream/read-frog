import type { Config } from '@/types/config/config'
import type { Point } from '@/types/dom'
import { getDetectedCodeFromStorage } from '@/utils/config/config'
import { isHTMLElement } from '../dom/filter'
import { findNearestAncestorBlockNodeAt } from '../dom/find'
import { walkAndLabelElement } from '../dom/traversal'
import { translateWalkedElement } from './core/translation-walker'
import { validateTranslationConfigAndToast } from './translate-text'

// Re-export public APIs
export { translateNodes, translateNodesBilingualMode, translateNodeTranslationOnlyMode } from './core/translation-modes'
export { translateWalkedElement } from './core/translation-walker'
export { removeAllTranslatedWrapperNodes } from './dom/translation-cleanup'

// High-level orchestration function
export async function removeOrShowNodeTranslation(point: Point, config: Config): Promise<void> {
  const node = findNearestAncestorBlockNodeAt(point)

  if (!node || !isHTMLElement(node))
    return

  const detectedCode = await getDetectedCodeFromStorage()

  if (!validateTranslationConfigAndToast({
    providersConfig: config.providersConfig,
    translate: config.translate,
    language: config.language,
  }, detectedCode)) {
    return
  }

  const id = crypto.randomUUID()
  walkAndLabelElement(node, id, config)
  await translateWalkedElement(node, id, config, true)
}
