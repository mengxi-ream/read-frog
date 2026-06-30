import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import type { JSONValue } from "ai"

type OpenAIReasoningEffort = Exclude<OpenAIResponsesProviderOptions["reasoningEffort"], undefined>

interface OpenAIGPT5ReasoningEffortPolicy {
  pattern: RegExp
  supportedValues: readonly OpenAIReasoningEffort[]
  recommendedValue?: OpenAIReasoningEffort
}

export const LLM_PROVIDER_MODELS = {
  "openai": ["gpt-5.5", "gpt-5.4-pro", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.3-chat-latest", "gpt-5.2-pro", "gpt-5.2-chat-latest", "gpt-5.2", "gpt-5.1-codex-mini", "gpt-5.1-codex", "gpt-5.1-chat-latest", "gpt-5.1", "gpt-5-pro", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-codex", "gpt-5-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini"],
  "azure": ["gpt-5.4-mini", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-nano", "gpt-5.3-chat", "gpt-5.2-chat", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "DeepSeek-V4-Flash", "DeepSeek-V4-Pro", "DeepSeek-V3.2", "DeepSeek-V3.1", "grok-4.3", "grok-4-20-non-reasoning", "grok-4-20-reasoning", "grok-4-1-fast-non-reasoning", "grok-4-1-fast-reasoning", "grok-4", "grok-code-fast-1"],
  "deepseek": ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
  "google": ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-image-preview", "gemini-3.1-flash-lite-preview", "gemini-3-pro-preview", "gemini-3-pro-image-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview-06-17", "gemini-2.0-flash"],
  "anthropic": ["claude-fable-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-opus-4-5", "claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-1", "claude-opus-4-0", "claude-sonnet-4-0"],
  "siliconflow": ["Qwen/Qwen3-Next-80B-A3B-Instruct"],
  "tensdaq": ["Qwen3-30B-A3B-Instruct-2507", "deepseek-v3.1"],
  "atlascloud": ["deepseek-ai/deepseek-v4-flash", "deepseek-ai/deepseek-v4-pro", "moonshotai/Kimi-K2-Instruct", "moonshotai/Kimi-K2-Instruct-0905", "moonshotai/kimi-k2.5", "qwen/qwen3.5-flash", "qwen/qwen3.5-plus", "qwen/qwen3.6-35b-a3b", "qwen/qwen3.6-plus", "qwen/qwen3.7-plus", "bytedance/doubao-seed-2.0-mini-260428", "bytedance/doubao-seed-2.0-lite-260428", "zai-org/glm-4.7", "zai-org/glm-5", "minimaxai/minimax-m2.7", "minimaxai/minimax-m3", "google/gemini-3.1-flash-lite"],
  "openai-compatible": ["use-custom-model"],
  "xai": ["grok-4.20-0309-non-reasoning", "grok-4.20-0309-reasoning", "grok-4.3"],
  "bedrock": ["amazon.titan-tg1-large", "amazon.titan-text-express-v1", "amazon.titan-text-lite-v1", "us.amazon.nova-premier-v1:0", "us.amazon.nova-pro-v1:0", "us.amazon.nova-lite-v1:0", "us.amazon.nova-micro-v1:0", "anthropic.claude-haiku-4-5-20251001-v1:0", "anthropic.claude-sonnet-4-20250514-v1:0", "anthropic.claude-sonnet-4-5-20250929-v1:0", "anthropic.claude-opus-4-20250514-v1:0", "anthropic.claude-opus-4-1-20250805-v1:0", "anthropic.claude-3-5-sonnet-20241022-v2:0", "anthropic.claude-3-5-sonnet-20240620-v1:0", "anthropic.claude-3-opus-20240229-v1:0", "anthropic.claude-3-sonnet-20240229-v1:0", "anthropic.claude-3-haiku-20240307-v1:0", "us.anthropic.claude-sonnet-4-20250514-v1:0", "us.anthropic.claude-sonnet-4-5-20250929-v1:0", "us.anthropic.claude-opus-4-20250514-v1:0", "us.anthropic.claude-opus-4-1-20250805-v1:0", "us.anthropic.claude-3-5-sonnet-20241022-v2:0", "us.anthropic.claude-3-5-sonnet-20240620-v1:0", "us.anthropic.claude-3-sonnet-20240229-v1:0", "us.anthropic.claude-3-opus-20240229-v1:0", "us.anthropic.claude-3-haiku-20240307-v1:0", "anthropic.claude-v2", "anthropic.claude-v2:1", "anthropic.claude-instant-v1", "cohere.command-text-v14", "cohere.command-light-text-v14", "cohere.command-r-v1:0", "cohere.command-r-plus-v1:0", "us.deepseek.r1-v1:0", "meta.llama3-8b-instruct-v1:0", "meta.llama3-70b-instruct-v1:0", "meta.llama3-1-8b-instruct-v1:0", "meta.llama3-1-70b-instruct-v1:0", "meta.llama3-1-405b-instruct-v1:0", "meta.llama3-2-1b-instruct-v1:0", "meta.llama3-2-3b-instruct-v1:0", "meta.llama3-2-11b-instruct-v1:0", "meta.llama3-2-90b-instruct-v1:0", "us.meta.llama3-2-1b-instruct-v1:0", "us.meta.llama3-2-3b-instruct-v1:0", "us.meta.llama3-2-11b-instruct-v1:0", "us.meta.llama3-2-90b-instruct-v1:0", "us.meta.llama3-1-8b-instruct-v1:0", "us.meta.llama3-1-70b-instruct-v1:0", "us.meta.llama3-3-70b-instruct-v1:0", "us.meta.llama4-scout-17b-instruct-v1:0", "us.meta.llama4-maverick-17b-instruct-v1:0", "mistral.mistral-7b-instruct-v0:2", "mistral.mixtral-8x7b-instruct-v0:1", "mistral.mistral-large-2402-v1:0", "mistral.mistral-small-2402-v1:0", "us.mistral.pixtral-large-2502-v1:0", "openai.gpt-oss-120b-1:0", "openai.gpt-oss-20b-1:0", "us.anthropic.claude-fable-5", "us.anthropic.claude-opus-4-8", "us.anthropic.claude-opus-4-7", "us.anthropic.claude-opus-4-6-v1", "us.anthropic.claude-opus-4-5-20251101-v1:0", "us.anthropic.claude-haiku-4-5-20251001-v1:0", "openai.gpt-oss-20b", "openai.gpt-oss-120b"],
  "groq": ["gemma2-9b-it", "llama-3.1-8b-instant", "llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "meta-llama/llama-4-maverick-17b-128e-instruct", "meta-llama/llama-4-scout-17b-16e-instruct", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b", "llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "qwen-qwq-32b", "qwen-2.5-32b", "deepseek-r1-distill-qwen-32b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"],
  "deepinfra": ["meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", "meta-llama/Llama-4-Scout-17B-16E-Instruct", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "meta-llama/Llama-3.3-70B-Instruct", "meta-llama/Meta-Llama-3.1-405B-Instruct", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-70B-Instruct", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct", "meta-llama/Llama-3.2-11B-Vision-Instruct", "meta-llama/Llama-3.2-90B-Vision-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1", "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", "deepseek-ai/DeepSeek-R1-Turbo", "nvidia/Llama-3.1-Nemotron-70B-Instruct", "Qwen/Qwen2-7B-Instruct", "Qwen/Qwen2.5-72B-Instruct", "Qwen/Qwen2.5-Coder-32B-Instruct", "Qwen/QwQ-32B-Preview", "google/codegemma-7b-it", "google/gemma-2-9b-it", "microsoft/WizardLM-2-8x22B"],
  "mistral": ["pixtral-large-latest", "mistral-large-latest", "mistral-medium-latest", "mistral-medium-3", "mistral-medium-2508", "mistral-medium-2505", "mistral-medium-3.5", "mistral-small-latest", "magistral-small-2507", "magistral-medium-2507", "magistral-small-2506", "magistral-medium-2506", "ministral-3b-latest", "ministral-8b-latest", "pixtral-12b-2409", "open-mistral-7b", "open-mixtral-8x7b", "open-mixtral-8x22b"],
  "togetherai": ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3", "meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "mistralai/Mixtral-8x22B-Instruct-v0.1", "mistralai/Mistral-7B-Instruct-v0.3", "databricks/dbrx-instruct", "google/gemma-2b-it"],
  "cohere": ["command-a-03-2025", "command-a-reasoning-08-2025", "command-a-vision-07-2025", "command-r7b-12-2024", "command-r-plus-04-2024", "command-r-plus", "command-r-08-2024", "command-r-03-2024", "command-r", "command", "command-nightly", "command-light", "command-light-nightly"],
  "fireworks": ["accounts/fireworks/models/firefunction-v1", "accounts/fireworks/models/deepseek-r1", "accounts/fireworks/models/deepseek-v3", "accounts/fireworks/models/llama-v3p1-405b-instruct", "accounts/fireworks/models/llama-v3p1-8b-instruct", "accounts/fireworks/models/llama-v3p2-3b-instruct", "accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/mixtral-8x7b-instruct", "accounts/fireworks/models/mixtral-8x7b-instruct-hf", "accounts/fireworks/models/mixtral-8x22b-instruct", "accounts/fireworks/models/qwen2p5-coder-32b-instruct", "accounts/fireworks/models/qwen2p5-72b-instruct", "accounts/fireworks/models/qwen-qwq-32b-preview", "accounts/fireworks/models/qwen2-vl-72b-instruct", "accounts/fireworks/models/llama-v3p2-11b-vision-instruct", "accounts/fireworks/models/qwq-32b", "accounts/fireworks/models/yi-large", "accounts/fireworks/models/kimi-k2-instruct", "accounts/fireworks/models/kimi-k2-thinking", "accounts/fireworks/models/kimi-k2p5", "accounts/fireworks/models/minimax-m2"],
  "cerebras": ["llama3.1-8b", "llama-3.3-70b", "gpt-oss-120b", "qwen-3-32b", "qwen-3-235b-a22b-instruct-2507", "qwen-3-235b-a22b-thinking-2507", "zai-glm-4.6", "zai-glm-4.7"],
  "replicate": ["meta/meta-llama-3.1-70b-instruct", "meta/meta-llama-3.1-8b-instruct"],
  "perplexity": ["sonar-deep-research", "sonar-reasoning-pro", "sonar-reasoning", "sonar-pro", "sonar"],
  "vercel": ["v0-1.5-md", "v0-1.5-lg", "v0-1.0-md"],
  "openrouter": ["x-ai/grok-4-fast:free", "openai/gpt-4.1-mini"],
  "ollama": ["gemma4:e2b", "gemma4:e4b", "gemma3:4b", "llama3.2:3b"],
  "volcengine": ["doubao-seed-1-6-flash-250828", "doubao-seed-1-6-lite-251015", "doubao-seed-1-6-251015"],
  "minimax": ["MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed", "MiniMax-M2.1", "MiniMax-M2.1-highspeed", "MiniMax-M2", "MiniMax-M2-Stable"],
  "alibaba": ["qwen3-max", "qwen3.5-plus", "qwen3.5-flash", "qwen-plus", "qwen-flash", "qwen-turbo", "qwq-plus", "qwen3-coder-plus", "deepseek-v3.2", "deepseek-v3.1", "deepseek-r1", "deepseek-v3", "kimi-k2.5", "MiniMax-M2.5", "glm-5"],
  "moonshotai": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2", "kimi-k2.5", "kimi-k2-thinking", "kimi-k2-thinking-turbo", "kimi-k2-turbo"],
  "huggingface": ["meta-llama/Llama-3.1-8B-Instruct", "meta-llama/Llama-3.1-70B-Instruct", "meta-llama/Llama-3.3-70B-Instruct", "meta-llama/Llama-4-Maverick-17B-128E-Instruct", "deepseek-ai/DeepSeek-V3.1", "deepseek-ai/DeepSeek-V3-0324", "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", "Qwen/Qwen3-32B", "Qwen/Qwen3-Coder-480B-A35B-Instruct", "Qwen/Qwen2.5-VL-7B-Instruct", "google/gemma-3-27b-it", "moonshotai/Kimi-K2-Instruct"],
} as const

export const NON_API_TRANSLATE_PROVIDERS = ["google-translate", "microsoft-translate"] as const
export const NON_API_TRANSLATE_PROVIDERS_MAP: Record<typeof NON_API_TRANSLATE_PROVIDERS[number], string> = {
  "google-translate": "Google Translate",
  "microsoft-translate": "Microsoft Translator",
}

export const PURE_TRANSLATE_PROVIDERS = ["google-translate", "microsoft-translate", "deeplx", "deepl"] as const

const OPENAI_GPT5_REASONING_EFFORT_POLICIES: OpenAIGPT5ReasoningEffortPolicy[] = [
  {
    pattern: /^gpt-5\.4-pro$/i,
    supportedValues: ["medium", "high", "xhigh"],
    recommendedValue: "medium",
  },
  {
    pattern: /^gpt-5\.2-pro$/i,
    supportedValues: ["medium", "high", "xhigh"],
    recommendedValue: "medium",
  },
  {
    pattern: /^gpt-5-pro$/i,
    supportedValues: ["high"],
    recommendedValue: "high",
  },
  {
    pattern: /^(?:gpt-5\.5|gpt-5\.4|gpt-5\.4-mini|gpt-5\.4-nano)$/i,
    supportedValues: ["none", "low", "medium", "high", "xhigh"],
    recommendedValue: "none",
  },
  {
    pattern: /^gpt-5\.2$/i,
    supportedValues: ["none", "low", "medium", "high", "xhigh"],
    recommendedValue: "none",
  },
  {
    pattern: /^(?:gpt-5\.1|gpt-5\.1-codex|gpt-5\.1-codex-mini)$/i,
    supportedValues: ["none", "low", "medium", "high"],
    recommendedValue: "none",
  },
  {
    pattern: /^(?:gpt-5|gpt-5-mini|gpt-5-nano|gpt-5-codex)$/i,
    supportedValues: ["minimal", "low", "medium", "high"],
    recommendedValue: "minimal",
  },
  {
    pattern: /^(?:gpt-5-chat-latest|gpt-5\.1-chat-latest|gpt-5\.2-chat-latest|gpt-5\.3-chat-latest)$/i,
    supportedValues: [],
  },
]

const OPENAI_GPT5_RECOMMENDED_MODEL_OPTIONS: Array<{
  pattern: RegExp
  options: Record<string, JSONValue>
}> = OPENAI_GPT5_REASONING_EFFORT_POLICIES.flatMap(({ pattern, recommendedValue }) => {
  if (recommendedValue === undefined) {
    return []
  }

  return [{
    pattern,
    options: { reasoningEffort: recommendedValue },
  }]
})

export function getOpenAIGPT5ReasoningEffortPolicy(model: string): OpenAIGPT5ReasoningEffortPolicy | undefined {
  return OPENAI_GPT5_REASONING_EFFORT_POLICIES.find(({ pattern }) => pattern.test(model))
}

/**
 * Model options configuration.
 * Flat list design: first match wins, more specific patterns should be placed first.
 * Options are matched by model name, not by provider.
 */
export const LLM_MODEL_OPTIONS: Array<{
  pattern: RegExp
  options: Record<string, JSONValue>
}> = [
  // Gemini - specific patterns first
  {
    pattern: /^gemini-3(?:\.\d+)?-.*?(?:-preview(?:-customtools)?)?$/i,
    options: { thinkingConfig: { thinkingLevel: "minimal", includeThoughts: false } },
  },
  {
    pattern: /^gemini-2\.5-/i,
    options: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } },
  },
  {
    // Default for all other Gemini models
    pattern: /^gemini-/i,
    options: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } },
  },

  // Claude - disable thinking
  {
    pattern: /^claude-/i,
    options: { thinking: { type: "disabled" } },
  },

  // OpenAI reasoning models - use the lowest supported reasoning effort
  {
    pattern: /^(?:o1|o3|o4-mini)(?:-|$)/i,
    options: { reasoningEffort: "minimal" },
  },

  // OpenAI GPT-5 defaults use the lowest supported reasoning effort per model.
  // GPT-5 chat-latest variants are intentionally omitted because their docs do not advertise reasoning.effort.
  ...OPENAI_GPT5_RECOMMENDED_MODEL_OPTIONS,

  // xAI Grok reasoning-capable text models - keep effort at the lowest supported level.
  // Non-reasoning Grok variants are intentionally omitted because they do not need reasoning options.
  // TODO: switch Grok 4.3 to the non-reasoning path once stable @ai-sdk/xai supports reasoning.effort = "none".
  {
    pattern: /^(?:grok-4\.3|grok-4\.20-0309-reasoning)$/i,
    options: { reasoningEffort: "low" },
  },

  // OpenAI-compatible reasoning models exposed by Groq/Cerebras and similar providers
  {
    pattern: /^(?:openai\/)?gpt-oss-(?:20|120)b$/i,
    options: { reasoningEffort: "none" },
  },

  // Volcengine Doubao Seed models - disable thinking by default.
  // Keep the version suffix optional because non-Volcengine providers may expose the same model family without it.
  {
    pattern: /(?:^|\/)doubao-seed-(?:code-preview|1[.-](?:6(?:-(?:flash|vision))?|8)|2[.-]0-(?:lite|mini|pro|code-preview))(?:-\d{6})?$/i,
    options: { thinking: { type: "disabled" } },
  },

  // DeepSeek reasoning models - disable thinking by default
  {
    pattern: /(?:^|\/)deepseek-(?:reasoner|v4-(?:flash|pro))$/i,
    options: { thinking: { type: "disabled" } },
  },

  // Cohere reasoning models - disable thinking by default
  {
    pattern: /^command-a-reasoning(?:-.+)?$/i,
    options: { thinking: { type: "disabled" } },
  },

  // Fireworks reasoning-focused models - disable thinking/history by default
  {
    pattern: /^accounts\/fireworks\/models\/(?:kimi-k2(?:[a-z0-9.-].*)?|minimax-m2(?:[.-].*)?)$/i,
    options: { thinking: { type: "disabled" }, reasoningHistory: "disabled" },
  },

  // Kimi K2 models - disable thinking/history by default.
  // Keep instruct variants untouched; they should not receive Moonshot's `thinking` options.
  // Keep this broad because recommendation matching is model-name based rather than provider-scoped.
  {
    pattern: /(?:^|\/)kimi-k2(?!-instruct(?:[a-z0-9.-].*)?$)(?:[a-z0-9.-].*)?$/i,
    options: { thinking: { type: "disabled" }, reasoningHistory: "disabled" },
  },

  // Namespaced Qwen3 models - disable reasoning by default.
  // Keep this before the broad Qwen rule so OpenAI-compatible Qwen3 ids can use reasoningEffort.
  {
    pattern: /(?:^|\/)qwen\/qwen3(?!.*[/.-](?:thinking|qwq)(?:[/.-]|$))[a-z0-9.-]*$/i,
    options: { reasoningEffort: "none" },
  },

  // Qwen models - disable thinking by default.
  // Keep this broad because recommendation matching is model-name based rather than provider-scoped.
  // Exclude Cerebras-style `qwen-3-*` ids; they do not support Alibaba's `enableThinking`.
  // Keep explicit thinking-only variants (for example `qwq-*` and `*-thinking`) untouched.
  {
    pattern: /(?:^|\/)qwen(?!-3-)(?!.*[/.-](?:thinking|qwq)(?:[/.-]|$)).*$/i,
    options: { enableThinking: false },
  },

  // GLM models - disable thinking (compatibility issues)
  {
    pattern: /(?:^|\/)GLM-/i,
    options: { thinking: { type: "disabled" } },
  },
]
