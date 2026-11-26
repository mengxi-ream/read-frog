import type { Config } from "@/types/config/config"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { promptForBuiltInAiRefusal } from "@/utils/content-runtime/built-in-ai-prompt"
import { removeOrShowNodeTranslation } from "@/utils/host/translate/node-manipulation"
import {
  isPageTranslationRequestFailureClaimed,
  onPageTranslationRequestFailed,
} from "@/utils/host/translate/translation-session"
import { getBuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import { sendMessage } from "@/utils/message"
import { createNodeTranslationPreview } from "./node-translation-preview"
import { registerNodeTranslationTriggerListeners } from "./node-translation-trigger"

/**
 * Registers node translation triggers based on the current config.
 * Returns a teardown function to remove all listeners.
 *
 * Config is read on demand when the interaction fires so long-lived content
 * scripts don't drift if the page was frozen and missed storage events.
 */
export function registerNodeTranslationTriggers(): () => void {
  const ac = new AbortController()
  const { signal } = ac

  const getCurrentConfig = async (): Promise<Config | null> => {
    const config = await getLocalConfig()
    if (signal.aborted) return null
    return config ?? DEFAULT_CONFIG
  }

  let hasRequestedIframeInjection = false

  const requestIframeInjectionAfterSuccessfulTopFrameNodeTranslation = () => {
    if (hasRequestedIframeInjection || window !== window.top || signal.aborted) return

    hasRequestedIframeInjection = true
    void sendMessage("injectCurrentIframesAfterTopFrameNodeTranslation", undefined).catch(
      () => undefined,
    )
  }

  const translateNode = async (block: Element, config: Config) => {
    // A paragraph's error is drawn in place and reported, never thrown, and the call
    // returns once every paragraph of the node is done, so its refusals are the ones
    // reported meanwhile. Another node's hover can overlap and land here too: the prompt
    // is one per refusal, whichever node it names.
    let refusal: unknown
    const stopListening = onPageTranslationRequestFailed((error) => {
      if (refusal === undefined && getBuiltInAiRefusalKind(error)) {
        refusal = error
      }
    })
    let didTranslate: boolean
    try {
      didTranslate = await removeOrShowNodeTranslation(block, config)
    } finally {
      stopListening()
    }
    if (didTranslate) {
      requestIframeInjectionAfterSuccessfulTopFrameNodeTranslation()
    }

    // A page-translation session that already asked about this refusal answers for it.
    if (
      refusal === undefined ||
      signal.aborted ||
      isPageTranslationRequestFailureClaimed(refusal)
    ) {
      return
    }
    void promptForBuiltInAiRefusal(refusal, {
      // Hover translation runs on page translation's provider.
      feature: "pageTranslation",
      analyticsFeature: ANALYTICS_FEATURE.PAGE_TRANSLATION,
      trigger: "user",
      retry: () => void retranslateNode(block),
    })
  }

  /**
   * After a switch to machine translation: the node's paragraphs all carry a translation
   * or an inline error now, so the first toggle takes them off and the second translates
   * the node again on the new provider.
   */
  const retranslateNode = async (block: Element) => {
    const config = await getCurrentConfig()
    if (!config) return
    await removeOrShowNodeTranslation(block, config)
    await translateNode(block, config)
  }

  const preview = createNodeTranslationPreview()
  const teardownTriggerListeners = registerNodeTranslationTriggerListeners({
    getConfig: getCurrentConfig,
    onTrigger: (block, config) => {
      void translateNode(block, config)
    },
    preview,
  })

  // Teardown: abort all listeners + cancel pending timers
  return () => {
    ac.abort()
    teardownTriggerListeners()
    preview.destroy()
  }
}
