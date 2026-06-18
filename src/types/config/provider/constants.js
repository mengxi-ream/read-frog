import { LLM_PROVIDER_MODELS, NON_API_TRANSLATE_PROVIDERS, NON_API_TRANSLATE_PROVIDERS_MAP, PURE_TRANSLATE_PROVIDERS } from "@/utils/constants/models";
// Re-export for external consumers.
export { LLM_PROVIDER_MODELS, NON_API_TRANSLATE_PROVIDERS, NON_API_TRANSLATE_PROVIDERS_MAP, PURE_TRANSLATE_PROVIDERS };
/* ──────────────────────────────
  Derived provider names
  ────────────────────────────── */
// translate provider names
export const TRANSLATE_PROVIDER_TYPES = ["google-translate", "microsoft-translate", "deeplx", "deepl", "openai", "deepseek", "google", "anthropic", "xai", "openai-compatible", "siliconflow", "tensdaq", "bedrock", "groq", "deepinfra", "mistral", "togetherai", "cohere", "fireworks", "cerebras", "replicate", "perplexity", "vercel", "openrouter", "ollama", "volcengine", "minimax", "alibaba", "moonshotai", "huggingface"];
export function isTranslateProvider(provider) {
    return TRANSLATE_PROVIDER_TYPES.includes(provider);
}
export const LLM_PROVIDER_TYPES = ["openai", "deepseek", "google", "anthropic", "xai", "openai-compatible", "siliconflow", "tensdaq", "bedrock", "groq", "deepinfra", "mistral", "togetherai", "cohere", "fireworks", "cerebras", "replicate", "perplexity", "vercel", "openrouter", "ollama", "volcengine", "minimax", "alibaba", "moonshotai", "huggingface"];
export function isLLMProvider(provider) {
    return LLM_PROVIDER_TYPES.includes(provider);
}
export const CUSTOM_LLM_PROVIDER_TYPES = ["openai-compatible", "tensdaq", "siliconflow", "volcengine"];
export function isCustomLLMProvider(provider) {
    return CUSTOM_LLM_PROVIDER_TYPES.includes(provider);
}
export const NON_CUSTOM_LLM_PROVIDER_TYPES = ["openai", "deepseek", "google", "anthropic", "xai", "bedrock", "groq", "deepinfra", "mistral", "togetherai", "cohere", "fireworks", "cerebras", "replicate", "perplexity", "vercel", "openrouter", "ollama", "minimax", "alibaba", "moonshotai", "huggingface"];
export function isNonCustomLLMProvider(provider) {
    return NON_CUSTOM_LLM_PROVIDER_TYPES.includes(provider);
}
export const API_PROVIDER_TYPES = ["siliconflow", "tensdaq", "openai-compatible", "openai", "deepseek", "google", "anthropic", "xai", "deeplx", "deepl", "bedrock", "groq", "deepinfra", "mistral", "togetherai", "cohere", "fireworks", "cerebras", "replicate", "perplexity", "vercel", "openrouter", "ollama", "volcengine", "minimax", "alibaba", "moonshotai", "huggingface"];
export function isAPIProvider(provider) {
    return API_PROVIDER_TYPES.includes(provider);
}
export const PURE_API_PROVIDER_TYPES = ["deeplx", "deepl"];
export function isPureAPIProvider(provider) {
    return PURE_API_PROVIDER_TYPES.includes(provider);
}
export function isNonAPIProvider(provider) {
    return NON_API_TRANSLATE_PROVIDERS.includes(provider);
}
// all provider names
export const ALL_PROVIDER_TYPES = ["google-translate", "microsoft-translate", "deeplx", "deepl", "siliconflow", "tensdaq", "openai-compatible", "openai", "deepseek", "google", "anthropic", "xai", "bedrock", "groq", "deepinfra", "mistral", "togetherai", "cohere", "fireworks", "cerebras", "replicate", "perplexity", "vercel", "openrouter", "ollama", "volcengine", "minimax", "alibaba", "moonshotai", "huggingface"];
export function isPureTranslateProvider(provider) {
    return PURE_TRANSLATE_PROVIDERS.includes(provider);
}
