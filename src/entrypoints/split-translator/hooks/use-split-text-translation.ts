import type { LangCodeISO6393 } from "@read-frog/definitions"
import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { configAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { DEFAULT_DETECTED_CODE } from "@/utils/constants/config"
import { detectLanguage } from "@/utils/content/language"
import {
  MIN_LENGTH_FOR_SKIP_LLM_DETECTION,
  translateTextCore,
  validateTranslationConfigAndToast,
} from "@/utils/host/translate/translate-text"

export type SplitTextTranslationState
  = | { status: "idle" }
    | { status: "loading", input: string }
    | { status: "success", input: string, result: string }
    | { status: "error", input: string, error: string }

function toErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : i18n.t("splitTranslator.translationFailedFallback")
}

const HAN_SCRIPT_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/u

function detectSplitTranslatorShortTextLanguage(text: string): LangCodeISO6393 | null {
  return HAN_SCRIPT_RE.test(text) ? "cmn" : null
}

export function useSplitTextTranslation() {
  const config = useAtomValue(configAtom)
  const [state, setState] = useState<SplitTextTranslationState>({ status: "idle" })
  const runIdRef = useRef(0)

  const translate = useCallback(async (
    rawInput: string,
    targetCode: LangCodeISO6393 = config.language.targetCode,
  ) => {
    const input = rawInput.trim()
    if (!input) {
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setState({ status: "loading", input: rawInput })

    try {
      const languageConfig = {
        ...config.language,
        targetCode,
      }
      const translationConfig = {
        ...config,
        language: languageConfig,
      }
      const providerConfig = getProviderConfigById(config.providersConfig, config.translate.providerId)
      if (!providerConfig) {
        throw new Error(i18n.t("splitTranslator.providerNotFound"))
      }

      const detectedCode: LangCodeISO6393 = languageConfig.sourceCode === "auto"
        ? detectSplitTranslatorShortTextLanguage(input)
          ?? (await detectLanguage(input, {
            enableLLM: config.languageDetection.mode === "llm",
            minLength: MIN_LENGTH_FOR_SKIP_LLM_DETECTION,
            suppressFallbackToast: true,
          }))
          ?? DEFAULT_DETECTED_CODE
        : languageConfig.sourceCode

      if (runIdRef.current !== runId) {
        return
      }

      if (!validateTranslationConfigAndToast(translationConfig, detectedCode)) {
        setState({
          status: "error",
          input: rawInput,
          error: i18n.t("splitTranslator.invalidConfiguration"),
        })
        return
      }

      const result = await translateTextCore({
        text: input,
        langConfig: languageConfig,
        providerConfig,
        enableAIContentAware: config.translate.enableAIContentAware,
        extraHashTags: ["splitTranslator"],
      })

      if (runIdRef.current !== runId) {
        return
      }

      setState({ status: "success", input: rawInput, result })
    }
    catch (error) {
      if (runIdRef.current !== runId) {
        return
      }

      const message = toErrorMessage(error)
      toast.error(message)
      setState({ status: "error", input: rawInput, error: message })
    }
  }, [config])

  const reset = useCallback(() => {
    runIdRef.current += 1
    setState({ status: "idle" })
  }, [])

  return {
    reset,
    state,
    translate,
  }
}
