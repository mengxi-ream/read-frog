import type { CachedWebPageContext } from "./webpage-context"
import type { ProviderConfig } from "@/types/config/provider"
import { isLLMProviderConfig } from "@/types/config/provider"
import { sendMessage } from "@/utils/message"

export async function getOrGenerateWebPageSummary(
  webPageContext: CachedWebPageContext | null,
  providerConfig: ProviderConfig,
  enableAIContentAware: boolean,
): Promise<string | null> {
  if (!enableAIContentAware || !isLLMProviderConfig(providerConfig) || !webPageContext) {
    return null
  }

  const { webTitle, webContent } = webPageContext
  if (!webTitle.trim() || !webContent.trim()) {
    return null
  }

  const summary = await sendMessage("getOrGenerateWebPageSummary", {
    webTitle,
    webContent,
    providerConfig,
  })

  return summary || null
}
