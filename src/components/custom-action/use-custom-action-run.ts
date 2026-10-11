import type { RefObject } from "react"
import { useAtom, useAtomValue } from "jotai"
import { useCallback, useMemo } from "react"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { customActionRequestAtom } from "./atoms"
import { useActiveCustomAction } from "./use-active-custom-action"
import {
  buildCustomActionExecutionPlan,
  useCustomActionExecution,
  useCustomActionWebPageContext,
} from "./use-custom-action-execution"
import { useTrackPrecheckFailure } from "./use-track-precheck-failure"

export type CustomActionRun = ReturnType<typeof useCustomActionRun>

export function useCustomActionRun(bodyRef: RefObject<HTMLDivElement | null>) {
  const [request, setRequest] = useAtom(customActionRequestAtom)
  const language = useAtomValue(configFieldsAtomMap.language)
  const { action, provider, providers, changeProvider } = useActiveCustomAction(request)
  const open = request !== null
  const selectionText = request?.selectionText ?? ""
  const webPageContext = useCustomActionWebPageContext(open, request?.sessionKey ?? 0)

  const executionPlan = useMemo(
    () =>
      buildCustomActionExecutionPlan(
        { language, action, provider },
        selectionText,
        request?.contextText ?? "",
        webPageContext,
      ),
    [action, language, provider, request?.contextText, selectionText, webPageContext],
  )
  const { executionContext } = executionPlan
  const execution = useCustomActionExecution({
    bodyRef,
    analyticsSurface: request?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    executionContext,
    open,
    popoverSessionKey: request?.sessionKey ?? 0,
    rerunNonce: request?.rerunNonce ?? 0,
  })

  useTrackPrecheckFailure({
    request,
    action,
    provider,
    precheckError: executionContext ? null : executionPlan.error,
  })

  const regenerate = useCallback(() => {
    if (request) {
      setRequest({ ...request, rerunNonce: request.rerunNonce + 1 })
    }
  }, [request, setRequest])

  const error = execution.error ?? executionPlan.error
  const isRunning =
    (open && webPageContext === undefined) || (executionContext ? execution.isRunning : false)

  return {
    request,
    action,
    provider,
    providers,
    titleText: (webPageContext?.webTitle ?? getSourceDocumentTitle()) || null,
    result: executionContext ? execution.result : null,
    error,
    isRunning,
    thinking: executionContext ? execution.thinking : null,
    layout: {
      status: isRunning ? ("streaming" as const) : error ? ("error" as const) : ("done" as const),
      // The layout's ctx mirrors the prompt tokens of the run on screen; before
      // there is one (precheck, page context still loading) it falls back to the
      // same sources those tokens are built from.
      selection: executionContext?.promptTokens.selection ?? selectionText,
      targetCode: executionContext?.targetCode ?? language.targetCode,
    },
    changeProvider,
    regenerate,
  }
}
