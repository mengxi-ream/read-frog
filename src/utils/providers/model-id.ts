import type { LLMProviderConfig } from "@/types/config/provider"

export function resolveModelId(providerModel: LLMProviderConfig["model"]) {
  return providerModel.isCustomModel
    ? providerModel.customModel?.trim()
    : providerModel.model?.trim()
}
