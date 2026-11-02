import type { SelectionToolbarTranslateRequestSlice } from "../atoms"
import type { BackgroundTextStreamSnapshot, ThinkingSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type { SelectionPromptContext } from "@/utils/prompts/selection-context"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type {
  ResolvedProviderRef,
  SelectionTranslationProviderRef,
  SystemProviderRef,
} from "@/utils/providers/provider-registry"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { classifyProviderConfig, classifyResolvedProvider } from "@/utils/analytics-provider"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { resolveGlossaryTermsFromCache } from "@/utils/glossary/active-matcher"
import { trackGlossaryUsed } from "@/utils/glossary/analytics"
import { translateTextCore } from "@/utils/host/translate/translate-text"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { getOrGenerateWebPageSummary } from "@/utils/host/translate/webpage-summary"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { checkProviderAvailability } from "@/utils/providers/provider-ref"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"

// The three ways a selection gets translated — hosted Built-in AI, a local
// LLM, a pure translate provider — shared by the translate button and word
// annotation, which shows the same translation between the lines. Either
// caller passes the paragraph(s) the selection sits in, so a word is rendered
// with the sense it has there.

/**
 * Page context for the selection prompt. `summaryProviderRef` is the provider
 * the (cached, smart-context-gated) page summary runs on — hosted and local
 * LLM refs both work; pass null to skip the summary while keeping the raw
 * context (pure translate providers, hosted tier unavailable).
 */
export async function getSelectionWebPagePromptContext(
  summaryProviderRef: PromptableProviderRef | null,
  enableAIContentAware: boolean,
) {
  const webPageContext = await getOrCreateWebPageContext()
  if (!webPageContext) {
    return undefined
  }

  const webSummary = summaryProviderRef
    ? await getOrGenerateWebPageSummary(
        webPageContext,
        summaryProviderRef,
        enableAIContentAware,
        "selectionTranslation",
      )
    : null
  return {
    webTitle: webPageContext.webTitle,
    webDescription: webPageContext.webDescription,
    webContent: webPageContext.webContent,
    webSummary: webSummary ?? undefined,
  }
}

export async function translateWithTextStream({
  preparedText,
  providerId,
  providerConfig,
  translateRequest,
  selectionContext,
  onChunk,
  registerAbortController,
}: {
  preparedText: string
  providerId: string
  providerConfig: LLMProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
  /** The paragraph(s) the selection sits in; see utils/prompts/selection-context.ts. */
  selectionContext?: SelectionPromptContext
  onChunk: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
}) {
  const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
  const modelName = resolveModelId(providerConfig.model)
  const reasoning = getTopLevelReasoning(providerConfig)
  const providerOptions = getProviderOptionsWithOverride(
    modelName ?? "",
    providerConfig.provider,
    providerConfig.providerOptions,
    reasoning,
  )
  const temperature = providerConfig.temperature
  const abortController = new AbortController()
  registerAbortController(abortController)

  const throwIfAborted = () => {
    if (abortController.signal.aborted) {
      throw new DOMException("aborted", "AbortError")
    }
  }

  const webPageContext = await getSelectionWebPagePromptContext(
    { kind: "local", config: providerConfig },
    translateRequest.enableAIContentAware,
  )
  throwIfAborted()

  // Read from the already-compiled matcher — no await on this path. See
  // `resolveGlossaryTermsFromCache`.
  const glossaryTerms = resolveGlossaryTermsFromCache(
    preparedText,
    translateRequest.glossaryEnabled,
    translateRequest.language.targetCode,
  )
  trackGlossaryUsed(
    "selectionTranslation",
    glossaryTerms,
    translateRequest.language.targetCode,
    classifyProviderConfig(providerConfig),
  )

  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    preparedText,
    {
      ...(webPageContext
        ? {
            context: {
              webTitle: webPageContext.webTitle,
              webDescription: webPageContext.webDescription,
              webContent: webPageContext.webContent,
              webSummary: webPageContext.webSummary,
            },
          }
        : {}),
      glossaryTerms,
      selectionContext,
    },
  )

  const translatedText = await streamBackgroundText(
    {
      providerKind: "local",
      providerId,
      instructions: systemPrompt,
      prompt,
      providerOptions,
      reasoning,
      temperature,
    },
    {
      signal: abortController.signal,
      onChunk,
    },
  )

  return translatedText
}

export async function translateWithHostedTextStream({
  preparedText,
  provider,
  translateRequest,
  selectionContext,
  onChunk,
  registerAbortController,
}: {
  preparedText: string
  provider: SystemProviderRef
  translateRequest: SelectionToolbarTranslateRequestSlice
  /** The paragraph(s) the selection sits in; see utils/prompts/selection-context.ts. */
  selectionContext?: SelectionPromptContext
  onChunk: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
}) {
  const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
  const abortController = new AbortController()
  registerAbortController(abortController)

  // Smart context on hosted runs mirrors the BYOK LLM path: the summary is
  // generated (and cached per page + provider) on the same Built-in AI
  // provider. Fail soft — a summary the tier cannot fund degrades to raw
  // context instead of blocking the translation, whose own stream surfaces
  // the real error.
  let summaryProviderRef: PromptableProviderRef | null = null
  if (translateRequest.enableAIContentAware) {
    const availability = await checkProviderAvailability(provider, "selectionTranslation")
    summaryProviderRef = availability.available ? availability.providerRef : null
  }
  const webPageContext = await getSelectionWebPagePromptContext(
    summaryProviderRef,
    translateRequest.enableAIContentAware,
  )
  const glossaryTerms = resolveGlossaryTermsFromCache(
    preparedText,
    translateRequest.glossaryEnabled,
    translateRequest.language.targetCode,
  )
  trackGlossaryUsed(
    "selectionTranslation",
    glossaryTerms,
    translateRequest.language.targetCode,
    classifyResolvedProvider(provider),
  )
  if (abortController.signal.aborted) {
    throw new DOMException("aborted", "AbortError")
  }

  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    preparedText,
    {
      ...(webPageContext
        ? {
            context: {
              webTitle: webPageContext.webTitle,
              webDescription: webPageContext.webDescription,
              webContent: webPageContext.webContent,
              webSummary: webPageContext.webSummary,
            },
          }
        : {}),
      glossaryTerms,
      selectionContext,
    },
  )

  return streamBackgroundText(
    {
      providerKind: "system",
      providerId: provider.id,
      modelTier: provider.modelTier,
      requestId: getRandomUUID(),
      hostedFeature: "selectionTranslation",
      instructions: systemPrompt,
      prompt,
    },
    {
      signal: abortController.signal,
      onChunk,
    },
  )
}

export async function translateWithStandardProvider({
  text,
  provider,
  translateRequest,
}: {
  text: string
  provider: ResolvedProviderRef<TranslateProviderConfig>
  translateRequest: SelectionToolbarTranslateRequestSlice
}) {
  // This path is reached only for pure translate providers (the dispatch sends
  // system refs to the hosted stream and local LLMs to the text stream), and
  // those take no prompt — requesting a summary for them was a doomed queue
  // task that could never generate text.
  const webPageContext = await getSelectionWebPagePromptContext(
    null,
    translateRequest.enableAIContentAware,
  )
  const translatedText = await translateTextCore({
    text,
    langConfig: translateRequest.language,
    providerConfig: provider,
    hostedFeature: "selectionTranslation",
    enableAIContentAware: translateRequest.enableAIContentAware,
    glossaryEnabled: translateRequest.glossaryEnabled,
    extraHashTags: ["selectionTranslation"],
    webPageContext,
  })

  return translatedText
}

/**
 * Why the configured provider cannot translate a selection right now, or
 * `null` when it can: the same prechecks the translate button makes before
 * it runs.
 */
export function checkSelectionTranslateProvider(
  provider: SelectionTranslationProviderRef | null,
): "providerUnavailable" | "providerDisabled" | null {
  if (!provider) return "providerUnavailable"
  if (provider.kind === "local" && !provider.config.enabled) return "providerDisabled"
  if (provider.kind === "local" && !isTranslateProviderConfig(provider.config)) {
    return "providerUnavailable"
  }
  return null
}

/**
 * Translates a selection on whichever provider is configured and resolves
 * with the finished text. A hosted or LLM provider streams; `onChunk` sees
 * the stream, and the result is its final output and thinking. A pure
 * translate provider has no thinking: `null`.
 */
export async function translateSelection({
  preparedText,
  provider,
  translateRequest,
  selectionContext,
  onChunk,
  registerAbortController,
}: {
  preparedText: string
  provider: SelectionTranslationProviderRef
  translateRequest: SelectionToolbarTranslateRequestSlice
  selectionContext?: SelectionPromptContext
  onChunk?: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
}): Promise<{ output: string; thinking: ThinkingSnapshot | null }> {
  const handleChunk = onChunk ?? (() => {})
  if (provider.kind === "system") {
    return translateWithHostedTextStream({
      preparedText,
      provider,
      translateRequest,
      selectionContext,
      onChunk: handleChunk,
      registerAbortController,
    })
  }
  if (!isTranslateProviderConfig(provider.config)) {
    throw new Error("The configured provider cannot translate a selection.")
  }
  if (isLLMProviderConfig(provider.config)) {
    const providerConfig = provider.config
    return translateWithTextStream({
      preparedText,
      providerId: providerConfig.id,
      providerConfig,
      translateRequest,
      selectionContext,
      onChunk: handleChunk,
      registerAbortController,
    })
  }
  const output = await translateWithStandardProvider({
    text: preparedText,
    provider,
    translateRequest,
  })
  return { output, thinking: null }
}
