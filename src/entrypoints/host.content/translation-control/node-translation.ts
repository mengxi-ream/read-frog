import type { Config } from "@/types/config/config"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { removeOrShowNodeTranslation } from "@/utils/host/translate/node-manipulation"
import { sendMessage } from "@/utils/message"
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
    if (signal.aborted)
      return null
    return config ?? DEFAULT_CONFIG
  }

  let hasRequestedIframeInjection = false

  const requestIframeInjectionAfterSuccessfulTopFrameNodeTranslation = () => {
    if (hasRequestedIframeInjection || window !== window.top || signal.aborted)
      return

    hasRequestedIframeInjection = true
    void sendMessage("injectCurrentIframesAfterTopFrameNodeTranslation", undefined)
      .catch(() => undefined)
  }

  const translateNode = async (point: Parameters<typeof removeOrShowNodeTranslation>[0], config: Config) => {
    const didTranslate = await removeOrShowNodeTranslation(point, config)
    if (didTranslate) {
      requestIframeInjectionAfterSuccessfulTopFrameNodeTranslation()
    }
  }

  const teardownTriggerListeners = registerNodeTranslationTriggerListeners({
    getConfig: getCurrentConfig,
    onTrigger: (point, config) => {
      void translateNode(point, config)
    },
  })

  // Teardown: abort all listeners + cancel pending timers
  return () => {
    ac.abort()
    teardownTriggerListeners()
  }
}
