import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { isHTMLElement } from "../dom/filter"
import { findNearestAncestorBlockNodeAt } from "../dom/find"
import { walkAndLabelElement } from "../dom/traversal"
import { translateWalkedElement } from "./core/translation-walker"
import { validateTranslationConfigAndToast } from "./translate-text"

// Re-export public APIs
export {
  translateNodes,
  translateNodesBilingualMode,
  translateNodeTranslationOnlyMode,
} from "./core/translation-modes"
export { translateWalkedElement } from "./core/translation-walker"
export { removeAllTranslatedWrapperNodes } from "./dom/translation-cleanup"

// High-level orchestration function
export async function removeOrShowNodeTranslation(point: Point, config: Config): Promise<boolean> {
  const node = findNearestAncestorBlockNodeAt(point, config)

  if (!node || !isHTMLElement(node)) return false

  const id = getRandomUUID()

  if (
    !validateTranslationConfigAndToast({
      providersConfig: config.providersConfig,
      pageTranslation: config.pageTranslation,
      language: config.language,
    })
  ) {
    return false
  }

  walkAndLabelElement(node, id, config)
  await translateWalkedElement(
    node,
    id,
    config,
    true,
    undefined,
    undefined,
    config.pageTranslation.node.forceRetranslation,
  )
  return true
}
