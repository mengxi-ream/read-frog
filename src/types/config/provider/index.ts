import type {
  APIProviderConfig,
  DedicatedLLMProviderConfig,
  LLMProviderConfig,
  NonAPIProviderConfig,
  OpenAICompatibleLLMProviderConfig,
  OpenResponsesLLMProviderConfig,
  ProtocolCompatibleLLMProviderConfig,
  ProviderConfig,
  PureAPIProviderConfig,
  TopLevelReasoningProviderConfig,
  TranslateProviderConfig,
} from "./schemas"
import {
  isAPIProvider,
  isDedicatedLLMProvider,
  isLLMProvider,
  isNonAPIProvider,
  isOpenAICompatibleLLMProvider,
  isOpenResponsesLLMProvider,
  isProtocolCompatibleLLMProvider,
  isPureAPIProvider,
  isPureTranslateProvider,
  isTranslateProvider,
  supportsTopLevelReasoning,
} from "./constants"

export * from "./constants"
export * from "./provider-specific-settings"
export * from "./schemas"

export function isTranslateProviderConfig(
  config: ProviderConfig,
): config is TranslateProviderConfig {
  return isTranslateProvider(config.provider)
}

export function isLLMProviderConfig(config: ProviderConfig): config is LLMProviderConfig {
  return isLLMProvider(config.provider)
}

export function isTopLevelReasoningProviderConfig(
  config: LLMProviderConfig,
): config is TopLevelReasoningProviderConfig {
  return supportsTopLevelReasoning(config.provider)
}

export function isOpenAICompatibleLLMProviderConfig(
  config: ProviderConfig,
): config is OpenAICompatibleLLMProviderConfig {
  return isOpenAICompatibleLLMProvider(config.provider)
}

export function isOpenResponsesLLMProviderConfig(
  config: ProviderConfig,
): config is OpenResponsesLLMProviderConfig {
  return isOpenResponsesLLMProvider(config.provider)
}

export function isProtocolCompatibleLLMProviderConfig(
  config: ProviderConfig,
): config is ProtocolCompatibleLLMProviderConfig {
  return isProtocolCompatibleLLMProvider(config.provider)
}

export function isDedicatedLLMProviderConfig(
  config: ProviderConfig,
): config is DedicatedLLMProviderConfig {
  return isDedicatedLLMProvider(config.provider)
}

export function isAPIProviderConfig(config: ProviderConfig): config is APIProviderConfig {
  return isAPIProvider(config.provider)
}

export function isPureAPIProviderConfig(config: ProviderConfig): config is PureAPIProviderConfig {
  return isPureAPIProvider(config.provider)
}

export function isNonAPIProviderConfig(config: ProviderConfig): config is NonAPIProviderConfig {
  return isNonAPIProvider(config.provider)
}

export function isPureTranslateProviderConfig(config: ProviderConfig): boolean {
  return isTranslateProvider(config.provider) && isPureTranslateProvider(config.provider)
}
