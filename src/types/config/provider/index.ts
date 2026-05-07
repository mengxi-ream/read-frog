import type {
  APIProviderConfig,
  CustomLLMProviderConfig,
  LLMProviderConfig,
  NonAPIProviderConfig,
  NonCustomLLMProviderConfig,
  ProviderConfig,
  PureAPIProviderConfig,
  TranslateProviderConfig,
} from "./schemas"
import {
  isAPIProvider,
  isCustomLLMProvider,
  isLLMProvider,
  isNonAPIProvider,
  isNonCustomLLMProvider,
  isPureAPIProvider,
  isPureTranslateProvider,
  isTranslateProvider,
} from "./constants"

export * from "./constants"
export * from "./provider-specific-settings"
export * from "./schemas"

export function isTranslateProviderConfig(config: ProviderConfig): config is TranslateProviderConfig {
  return isTranslateProvider(config.provider)
}

export function isLLMProviderConfig(config: ProviderConfig): config is LLMProviderConfig {
  return isLLMProvider(config.provider)
}

export function isCustomLLMProviderConfig(config: ProviderConfig): config is CustomLLMProviderConfig {
  return isCustomLLMProvider(config.provider)
}

export function isNonCustomLLMProviderConfig(config: ProviderConfig): config is NonCustomLLMProviderConfig {
  return isNonCustomLLMProvider(config.provider)
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
