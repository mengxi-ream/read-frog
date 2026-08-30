import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { logger } from "@/utils/logger"
import { getArticleSummaryPrompt } from "@/utils/prompts/summary"
import { MAX_TEXT_LENGTH } from "./utils"
import { cleanText } from "./utils"

/** The article title is untrusted page text; bound it like the body. */
const MAX_TITLE_LENGTH = 200

/**
 * Generate a brief summary of article content for translation context.
 *
 * Runs on either provider kind: `generateTextForProviderRef` picks the local
 * `generateText` call or the hosted stream. The same function serves the page
 * summary and the video summary, which is why the hosted feature is a
 * parameter rather than a constant.
 */
export async function generateArticleSummary(
  title: string,
  textContent: string,
  providerRef: PromptableProviderRef,
  options: {
    hostedFeature: HostedAiTextStreamRoute
    signal?: AbortSignal
    generate: (
      payload: {
        providerRef: PromptableProviderRef
        hostedFeature: HostedAiTextStreamRoute
        instructions: string
        prompt: string
      },
      runOptions: { signal?: AbortSignal },
    ) => Promise<string>
  },
): Promise<string | null> {
  const preparedText = cleanText(textContent, MAX_TEXT_LENGTH)

  if (!preparedText) {
    return null
  }

  try {
    const { systemPrompt, prompt } = getArticleSummaryPrompt(
      cleanText(title, MAX_TITLE_LENGTH),
      preparedText,
    )

    const summary = await options.generate(
      {
        providerRef,
        hostedFeature: options.hostedFeature,
        instructions: systemPrompt,
        prompt,
      },
      { signal: options.signal },
    )

    const cleanedSummary = summary.trim()
    logger.info("Generated article summary:", `${cleanedSummary.slice(0, 100)}...`)

    return cleanedSummary
  } catch (error) {
    logger.error("Failed to generate article summary:", error)
    return null
  }
}
