import type { AISDKReasoning, LLMProviderConfig } from "@/types/config/provider"
import { isTopLevelReasoningProviderConfig } from "@/types/config/provider"

export function getTopLevelReasoning(providerConfig: LLMProviderConfig): AISDKReasoning | undefined {
  if (!isTopLevelReasoningProviderConfig(providerConfig)) {
    return undefined
  }

  return providerConfig.reasoning
}
