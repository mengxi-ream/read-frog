import type { RefObject } from "react"
import type { SelectionToolbarCustomFeatureRequestSlice } from "../atoms"
import type { BackgroundStructuredObjectStreamSnapshot, ThinkingSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { useCallback, useEffect, useState } from "react"
import { isLLMProviderConfig } from "@/types/config/provider"
import { streamBackgroundStructuredObject } from "@/utils/content-script/background-stream-client"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { buildSelectionToolbarCustomFeatureSystemPrompt, replaceSelectionToolbarCustomFeaturePromptTokens } from "../custom-feature-prompt"

export interface CustomFeatureExecutionContext {
  feature: SelectionToolbarCustomFeature
  providerConfig: LLMProviderConfig
  promptTokens: {
    selection: string
    context: string
    targetLang: string
    title: string
  }
}

interface CustomFeatureExecutionPlan {
  errorMessage: string | null
  executionContext: CustomFeatureExecutionContext | null
}

function getCustomFeatureErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Custom feature request failed"
}

function scrollSelectionPopoverBodyToBottom(ref: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  })
}

export function buildCustomFeatureExecutionPlan(
  customFeatureRequest: SelectionToolbarCustomFeatureRequestSlice,
  cleanSelection: string,
  paragraphText: string,
): CustomFeatureExecutionPlan {
  const feature = customFeatureRequest.feature

  if (!feature) {
    return {
      errorMessage: "Selected feature is unavailable",
      executionContext: null,
    }
  }

  if (!cleanSelection) {
    return {
      errorMessage: "No selected text available",
      executionContext: null,
    }
  }

  const providerConfig = customFeatureRequest.providerConfig
  if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
    return {
      errorMessage: "Selected provider is unavailable for this feature",
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
      feature,
      providerConfig,
      promptTokens: {
        selection: cleanSelection,
        context: paragraphText,
        targetLang: LANG_CODE_TO_EN_NAME[customFeatureRequest.language.targetCode],
        title: document.title,
      },
    },
  }
}

export function useCustomFeatureExecution({
  bodyRef,
  executionContext,
  open,
  popoverSessionKey,
  rerunNonce,
}: {
  bodyRef: RefObject<HTMLDivElement | null>
  executionContext: CustomFeatureExecutionContext | null
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
    const { feature, providerConfig, promptTokens } = executionContext

    const run = async () => {
      const systemPrompt = buildSelectionToolbarCustomFeatureSystemPrompt(
        feature.systemPrompt,
        promptTokens,
        feature.outputSchema,
      )
      const prompt = replaceSelectionToolbarCustomFeaturePromptTokens(feature.prompt, promptTokens)
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
            outputSchema: feature.outputSchema.map(({ name, type }) => ({ name, type })),
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
        setErrorMessage(getCustomFeatureErrorMessage(error))
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
