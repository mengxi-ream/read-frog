import type { CachedWebPageContext } from "./webpage-context"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { sendMessage } from "@/utils/message"

/**
 * `hostedFeature` is the route of the feature that triggered the summary: the
 * summary is a sub-call of that feature and bills against its quota, so the
 * caller that gated `providerRef` must name the same route here.
 */
export async function getOrGenerateWebPageSummary(
  webPageContext: CachedWebPageContext | null,
  providerRef: PromptableProviderRef,
  enableAIContentAware: boolean,
  hostedFeature: HostedAiTextStreamRoute,
): Promise<string | null> {
  if (!enableAIContentAware || !webPageContext) {
    return null
  }

  const { webTitle, webContent } = webPageContext
  if (!webTitle.trim() || !webContent.trim()) {
    return null
  }

  const summary = await sendMessage("getOrGenerateWebPageSummary", {
    webTitle,
    webContent,
    providerRef,
    hostedFeature,
  })

  return summary || null
}
