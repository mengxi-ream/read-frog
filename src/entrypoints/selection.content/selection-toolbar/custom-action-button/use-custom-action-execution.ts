import type { RefObject } from "react"
import type { SelectionToolbarCustomActionRequestSlice } from "../atoms"
import type { BackgroundStructuredObjectStreamSnapshot, ThinkingSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { useCallback, useEffect, useState } from "react"
import { isLLMProviderConfig } from "@/types/config/provider"
import { streamBackgroundStructuredObject } from "@/utils/content-script/background-stream-client"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { buildSelectionToolbarCustomActionSystemPrompt, replaceSelectionToolbarCustomActionPromptTokens } from "../custom-action-prompt"

export interface CustomActionExecutionContext {
  action: SelectionToolbarCustomAction
  providerConfig: LLMProviderConfig
  promptTokens: {
    selection: string
    context: string
    targetLang: string
    title: string
  }
}

interface CustomActionExecutionPlan {
  errorMessage: string | null
  executionContext: CustomActionExecutionContext | null
}

function getCustomActionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Custom action request failed"
}

function scrollSelectionPopoverBodyToBottom(ref: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  })
}

export function buildCustomActionExecutionPlan(
  customActionRequest: SelectionToolbarCustomActionRequestSlice,
  cleanSelection: string,
  paragraphText: string,
): CustomActionExecutionPlan {
  const action = customActionRequest.action

  if (!action) {
    return {
      errorMessage: "Selected action is unavailable",
      executionContext: null,
    }
  }

  if (!cleanSelection) {
    return {
      errorMessage: "No selected text available",
      executionContext: null,
    }
  }

  const providerConfig = customActionRequest.providerConfig
  if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
    return {
      errorMessage: "Selected provider is unavailable for this action",
      executionContext: null,
    }
  }

  if (!providerConfig.enabled) {
    return {
      errorMessage: "Selected provider is disabled",
      executionContext: null,
    }
  }

  return {
    errorMessage: null,
    executionContext: {
      action,
      providerConfig,
      promptTokens: {
        selection: cleanSelection,
        context: paragraphText,
        targetLang: LANG_CODE_TO_EN_NAME[customActionRequest.language.targetCode],
        title: document.title,
      },
    },
  }
}

export function useCustomActionExecution({
  bodyRef,
  executionContext,
  open,
  popoverSessionKey,
  rerunNonce,
}: {
  bodyRef: RefObject<HTMLDivElement | null>
  executionContext: CustomActionExecutionContext | null
  open: boolean
  popoverSessionKey: number
  rerunNonce: number
}) {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [thinking, setThinking] = useState<ThinkingSnapshot | null>(null)

  const resetSessionState = useCallback(() => {
    setIsRunning(false)
    setResult(null)
    setErrorMessage(null)
    setThinking(null)
  }, [])

  useEffect(() => {
    if (!open || !executionContext) {
      return
    }

    let isCancelled = false
    const abortController = new AbortController()
    const { action, providerConfig, promptTokens } = executionContext

    const run = async () => {
      const systemPrompt = buildSelectionToolbarCustomActionSystemPrompt(
        action.systemPrompt,
        promptTokens,
        action.outputSchema,
      )
      const prompt = replaceSelectionToolbarCustomActionPromptTokens(action.prompt, promptTokens)
      const modelName = resolveModelId(providerConfig.model) ?? ""
      const providerOptions = getProviderOptionsWithOverride(
        modelName,
        providerConfig.provider,
        providerConfig.providerOptions,
      )

      setIsRunning(true)
      setResult(null)
      setErrorMessage(null)
      setThinking({
        status: "thinking",
        text: "",
      })

      try {
        const finalResult = await streamBackgroundStructuredObject(
          {
            providerId: providerConfig.id,
            system: systemPrompt,
            prompt,
            outputSchema: action.outputSchema.map(({ name, type }) => ({ name, type })),
            providerOptions,
            temperature: providerConfig.temperature,
          },
          {
            signal: abortController.signal,
            onChunk: (partial: BackgroundStructuredObjectStreamSnapshot) => {
              if (isCancelled) {
                return
              }

              setResult(partial.output)
              setThinking(partial.thinking)
              scrollSelectionPopoverBodyToBottom(bodyRef)
            },
          },
        )

        if (isCancelled) {
          return
        }

        setResult(finalResult.output)
        setThinking(finalResult.thinking)
      }
      catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        if (isCancelled) {
          return
        }

        setThinking(prev => prev?.text ? { ...prev, status: "complete" } : null)
        setErrorMessage(getCustomActionErrorMessage(error))
      }
      finally {
        if (!isCancelled) {
          setIsRunning(false)
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [bodyRef, executionContext, open, popoverSessionKey, rerunNonce])

  return {
    errorMessage,
    isRunning,
    resetSessionState,
    result,
    thinking,
  }
}
