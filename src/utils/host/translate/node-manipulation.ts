import type { AnalyticsSurface, TranslationActionContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { ANALYTICS_SURFACE, TRANSLATION_REQUESTED_FEATURE } from "@/types/analytics"
import { classifyTranslationRequest, trackTranslationRequested } from "@/utils/analytics"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { sendMessage } from "@/utils/message"
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
export async function removeOrShowNodeTranslation(
  point: Point,
  config: Config,
  surface?: AnalyticsSurface,
): Promise<boolean> {
  const node = findNearestAncestorBlockNodeAt(point)

  if (!node || !isHTMLElement(node)) return false

  const id = getRandomUUID()
  const analyticsSurface =
    surface ??
    (config.translate.node.hotkey === "clickAndHold"
      ? ANALYTICS_SURFACE.TOUCH_GESTURE
      : ANALYTICS_SURFACE.SHORTCUT)
  const actionContext: TranslationActionContext = {
    actionId: id,
    feature: TRANSLATION_REQUESTED_FEATURE.HOVER_TRANSLATION,
    surface: analyticsSurface,
  }

  await trackTranslationRequested({
    feature: TRANSLATION_REQUESTED_FEATURE.HOVER_TRANSLATION,
    surface: analyticsSurface,
    ...classifyTranslationRequest(
      resolveProviderConfigOrNull(config, "translate"),
      config.translate.customPromptsConfig.promptId,
    ),
  })

  if (
    !validateTranslationConfigAndToast({
      providersConfig: config.providersConfig,
      translate: config.translate,
      language: config.language,
    })
  ) {
    return false
  }

  walkAndLabelElement(node, id, config)
  try {
    await translateWalkedElement(node, id, config, true, undefined, undefined, actionContext)
  } finally {
    void Promise.resolve(sendMessage("clearPromptExperimentAction", { actionId: id })).catch(
      () => undefined,
    )
  }
  return true
}
