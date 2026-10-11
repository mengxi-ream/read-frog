import type { CustomActionRequest } from "./atoms"
import type { SelectionToolbarInlineError } from "@/components/ui/selection-popover/inline-error"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionProviderRef } from "@/utils/providers/provider-registry"
import { useEffect, useRef } from "react"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyResolvedProvider } from "@/utils/analytics-provider"

interface PrecheckFailure {
  request: CustomActionRequest | null
  action: SelectionToolbarCustomAction | null
  provider: CustomActionProviderRef | null
  precheckError: SelectionToolbarInlineError | null
}

export function useTrackPrecheckFailure({
  request,
  action,
  provider,
  precheckError,
}: PrecheckFailure) {
  const trackedFailureKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!request || !precheckError) {
      return
    }

    const failureKey = JSON.stringify({
      actionId: request.actionId,
      description: precheckError.description,
      sessionKey: request.sessionKey,
      surface: request.surface,
    })
    if (trackedFailureKeyRef.current === failureKey) {
      return
    }
    trackedFailureKeyRef.current = failureKey

    void trackFeatureUsed({
      ...createFeatureUsageContext(ANALYTICS_FEATURE.CUSTOM_AI_ACTION, request.surface),
      action_id: request.actionId,
      ...(action ? { action_name: action.name } : {}),
      ...classifyResolvedProvider(provider),
      outcome: "failure",
      failure_reason: "precheck",
    })
  }, [action, precheckError, provider, request])
}
