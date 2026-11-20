import type { HostedAiModel } from "@/utils/hosted-ai/models"
import { useEffect, useMemo, useState } from "react"
import {
  getHostedAiModelsFromStatus,
  readStoredHostedAiModels,
  storeHostedAiModels,
  watchStoredHostedAiModels,
} from "@/utils/hosted-ai/models"
import { useHostedAiStatus } from "./use-hosted-ai-status"

export interface BuiltInAiModelsResult {
  /**
   * The Built-in AI models, in the server's order: live from status, or the
   * last list the extension saw while status is loading or unreachable. Null
   * when there is neither.
   */
  models: readonly HostedAiModel[] | null
  /** True when `models` came from the status response just fetched. */
  isLive: boolean
}

/**
 * The one way UI reads the model list. Status is the authority; the stored
 * list keeps menus and the settings page naming the models while status is
 * still loading or cannot be reached. Whatever status returns is stored for
 * next time, so the options page keeps the list fresh even when no page has
 * run a hosted call through the background yet.
 */
export function useBuiltInAiModels(options: { enabled?: boolean } = {}): BuiltInAiModelsResult {
  const { status } = useHostedAiStatus(options)
  const liveModels = useMemo(() => getHostedAiModelsFromStatus(status), [status])
  const [storedModels, setStoredModels] = useState<HostedAiModel[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void readStoredHostedAiModels().then((models) => {
      if (!cancelled) {
        setStoredModels(models)
      }
    })
    const unwatch = watchStoredHostedAiModels(setStoredModels)
    return () => {
      cancelled = true
      unwatch()
    }
  }, [])

  useEffect(() => {
    if (liveModels) {
      void storeHostedAiModels(liveModels)
    }
  }, [liveModels])

  return liveModels ? { models: liveModels, isLive: true } : { models: storedModels, isLive: false }
}
