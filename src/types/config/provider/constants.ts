import {
  LLM_PROVIDER_MODELS,
  NON_API_TRANSLATE_PROVIDERS,
  NON_API_TRANSLATE_PROVIDERS_MAP,
  PURE_TRANSLATE_PROVIDERS,
} from "@/utils/constants/models"

// Re-export for external consumers.
export {
  LLM_PROVIDER_MODELS,
  NON_API_TRANSLATE_PROVIDERS,
  NON_API_TRANSLATE_PROVIDERS_MAP,
  PURE_TRANSLATE_PROVIDERS,
}

/* ──────────────────────────────
  Derived provider names
  ────────────────────────────── */

// translate provider names
export const TRANSLATE_PROVIDER_TYPES = [
  "google-translate",
  "microsoft-translate",
  "deeplx",
  "deepl",
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "openai-compatible",
  "open-responses",
  "jalapenocloud",
  "atlascloud",
  "openrouter",
  "minimax",
  "siliconflow",
  "tensdaq",
  "azure",
  "bedrock",
  "groq",
  "deepinfra",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "cerebras",
  "replicate",
  "perplexity",
  "vercel",
  "ollama",
  "volcengine",
  "alibaba",
  "moonshotai",
  "huggingface",
] as const satisfies Readonly<
  (keyof typeof LLM_PROVIDER_MODELS | (typeof PURE_TRANSLATE_PROVIDERS)[number])[]
>
export type TranslateProviderTypes = (typeof TRANSLATE_PROVIDER_TYPES)[number]
export function isTranslateProvider(provider: string): provider is TranslateProviderTypes {
  return TRANSLATE_PROVIDER_TYPES.includes(provider)
}

export const LLM_PROVIDER_TYPES = [
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "openai-compatible",
  "open-responses",
  "jalapenocloud",
  "atlascloud",
  "openrouter",
  "minimax",
  "siliconflow",
  "tensdaq",
  "azure",
  "bedrock",
  "groq",
  "deepinfra",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "cerebras",
  "replicate",
  "perplexity",
  "vercel",
  "ollama",
  "volcengine",
  "alibaba",
  "moonshotai",
  "huggingface",
] as const satisfies Readonly<(keyof typeof LLM_PROVIDER_MODELS)[]>
export type LLMProviderTypes = (typeof LLM_PROVIDER_TYPES)[number]
export function isLLMProvider(provider: string): provider is LLMProviderTypes {
  return LLM_PROVIDER_TYPES.includes(provider)
}

const OPENAI_COMPATIBLE_CUSTOM_LLM_PROVIDER_TYPE = "openai-compatible"
const OPEN_RESPONSES_CUSTOM_LLM_PROVIDER_TYPE = "open-responses"

const HOSTED_OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES = [
  "jalapenocloud",
  "atlascloud",
  "openrouter",
  "minimax",
  "siliconflow",
  "tensdaq",
  "volcengine",
] as const satisfies Readonly<LLMProviderTypes[]>

export const OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES = [
  OPENAI_COMPATIBLE_CUSTOM_LLM_PROVIDER_TYPE,
  ...HOSTED_OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES,
] as const satisfies Readonly<LLMProviderTypes[]>
export type OpenAICompatibleLLMProviderTypes = (typeof OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES)[number]
export function isOpenAICompatibleLLMProvider(
  provider: string,
): provider is OpenAICompatibleLLMProviderTypes {
  return OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES.includes(provider)
}

export const OPEN_RESPONSES_LLM_PROVIDER_TYPES = [
  OPEN_RESPONSES_CUSTOM_LLM_PROVIDER_TYPE,
] as const satisfies Readonly<LLMProviderTypes[]>
export type OpenResponsesLLMProviderTypes = (typeof OPEN_RESPONSES_LLM_PROVIDER_TYPES)[number]
export function isOpenResponsesLLMProvider(
  provider: string,
): provider is OpenResponsesLLMProviderTypes {
  return OPEN_RESPONSES_LLM_PROVIDER_TYPES.includes(provider)
}

export const PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES = [
  OPENAI_COMPATIBLE_CUSTOM_LLM_PROVIDER_TYPE,
  OPEN_RESPONSES_CUSTOM_LLM_PROVIDER_TYPE,
  ...HOSTED_OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES,
] as const satisfies Readonly<(OpenAICompatibleLLMProviderTypes | OpenResponsesLLMProviderTypes)[]>
export type ProtocolCompatibleLLMProviderTypes =
  (typeof PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES)[number]
export function isProtocolCompatibleLLMProvider(
  provider: string,
): provider is ProtocolCompatibleLLMProviderTypes {
  return PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES.includes(provider)
}

export const CUSTOM_MODEL_ONLY_PROVIDER_TYPES = [
  OPENAI_COMPATIBLE_CUSTOM_LLM_PROVIDER_TYPE,
  OPEN_RESPONSES_CUSTOM_LLM_PROVIDER_TYPE,
] as const satisfies Readonly<ProtocolCompatibleLLMProviderTypes[]>
export type CustomModelOnlyProviderTypes = (typeof CUSTOM_MODEL_ONLY_PROVIDER_TYPES)[number]
export function isCustomModelOnlyProvider(
  provider: string,
): provider is CustomModelOnlyProviderTypes {
  return CUSTOM_MODEL_ONLY_PROVIDER_TYPES.includes(provider)
}

export const DEDICATED_LLM_PROVIDER_TYPES = [
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "azure",
  "bedrock",
  "groq",
  "deepinfra",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "cerebras",
  "replicate",
  "perplexity",
  "vercel",
  "ollama",
  "alibaba",
  "moonshotai",
  "huggingface",
] as const satisfies Readonly<Exclude<LLMProviderTypes, ProtocolCompatibleLLMProviderTypes>[]>
export type DedicatedLLMProviderTypes = (typeof DEDICATED_LLM_PROVIDER_TYPES)[number]
export function isDedicatedLLMProvider(provider: string): provider is DedicatedLLMProviderTypes {
  return DEDICATED_LLM_PROVIDER_TYPES.includes(provider)
}

export const API_PROVIDER_TYPES = [
  "openai-compatible",
  "open-responses",
  "jalapenocloud",
  "atlascloud",
  "openrouter",
  "minimax",
  "siliconflow",
  "tensdaq",
  "volcengine",
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "deeplx",
  "deepl",
  "azure",
  "bedrock",
  "groq",
  "deepinfra",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "cerebras",
  "replicate",
  "perplexity",
  "vercel",
  "ollama",
  "alibaba",
  "moonshotai",
  "huggingface",
] as const satisfies Readonly<(keyof typeof LLM_PROVIDER_MODELS | "deeplx" | "deepl")[]>
export type APIProviderTypes = (typeof API_PROVIDER_TYPES)[number]
export function isAPIProvider(provider: string): provider is APIProviderTypes {
  return API_PROVIDER_TYPES.includes(provider)
}

export const PURE_API_PROVIDER_TYPES = ["deeplx", "deepl"] as const satisfies Readonly<
  Exclude<APIProviderTypes, LLMProviderTypes>[]
>
export type PureAPIProviderTypes = (typeof PURE_API_PROVIDER_TYPES)[number]
export function isPureAPIProvider(provider: string): provider is PureAPIProviderTypes {
  return PURE_API_PROVIDER_TYPES.includes(provider)
}

export type NonAPIProviderTypes = (typeof NON_API_TRANSLATE_PROVIDERS)[number]
export function isNonAPIProvider(provider: string): provider is NonAPIProviderTypes {
  return NON_API_TRANSLATE_PROVIDERS.includes(provider)
}

// all provider names
export const ALL_PROVIDER_TYPES = [
  "google-translate",
  "microsoft-translate",
  "deeplx",
  "deepl",
  "openai-compatible",
  "open-responses",
  "jalapenocloud",
  "atlascloud",
  "openrouter",
  "minimax",
  "siliconflow",
  "tensdaq",
  "volcengine",
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "azure",
  "bedrock",
  "groq",
  "deepinfra",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "cerebras",
  "replicate",
  "perplexity",
  "vercel",
  "ollama",
  "alibaba",
  "moonshotai",
  "huggingface",
] as const satisfies Readonly<TranslateProviderTypes[]>
export type AllProviderTypes = (typeof ALL_PROVIDER_TYPES)[number]

export const AI_SDK_REASONING_VALUES = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const
export type AISDKReasoning = (typeof AI_SDK_REASONING_VALUES)[number]

export const TOP_LEVEL_REASONING_PROVIDER_TYPES = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "groq",
  "deepseek",
  "fireworks",
  "bedrock",
] as const satisfies Readonly<LLMProviderTypes[]>
export type TopLevelReasoningProviderTypes = (typeof TOP_LEVEL_REASONING_PROVIDER_TYPES)[number]
export function supportsTopLevelReasoning(
  provider: string,
): provider is TopLevelReasoningProviderTypes {
  return TOP_LEVEL_REASONING_PROVIDER_TYPES.includes(provider)
}

export function isPureTranslateProvider(
  provider: TranslateProviderTypes,
): provider is (typeof PURE_TRANSLATE_PROVIDERS)[number] {
  return PURE_TRANSLATE_PROVIDERS.includes(provider)
}
