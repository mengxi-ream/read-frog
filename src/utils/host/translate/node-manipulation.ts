import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import { isHTMLElement } from "../dom/filter"
import { findNearestAncestorBlockNodeAt } from "../dom/find"
import { walkAndLabelElement } from "../dom/traversal"
import { translateWalkedElement } from "./core/translation-walker"
import { validateTranslationConfigAndToast } from "./translate-text"
import { beginNodeSiteRuleCSSOperation } from "./ui/node-site-rule-css"

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

  const rootNode = node.getRootNode()
  const styleRoot = rootNode instanceof ShadowRoot ? rootNode : document
  const siteRule = getEffectiveSiteRule(config, window.location.href)
  const releaseSiteRuleCSS = await beginNodeSiteRuleCSSOperation(styleRoot, siteRule.injectedCss)

  try {
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
  } finally {
    await releaseSiteRuleCSS()
  }
  return true
}
