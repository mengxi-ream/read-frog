import type { AllProviderTypes, APIProviderTypes, LLMProviderModels, ProviderConfig, ProvidersConfig, ProviderSponsorConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import customProviderLogo from "@/assets/providers/custom-provider.svg?url&no-inline"
import deeplxLogoDark from "@/assets/providers/deeplx-dark.svg?url&no-inline"
import deeplxLogoLight from "@/assets/providers/deeplx-light.svg?url&no-inline"
import tensdaqLogoColor from "@/assets/providers/tensdaq-color.svg?url&no-inline"
import { env } from "@/env"
import { API_PROVIDER_TYPES, CUSTOM_LLM_PROVIDER_TYPES, NON_API_TRANSLATE_PROVIDERS, NON_API_TRANSLATE_PROVIDERS_MAP, NON_CUSTOM_LLM_PROVIDER_TYPES, PURE_API_PROVIDER_TYPES, PURE_TRANSLATE_PROVIDERS, TRANSLATE_PROVIDER_TYPES } from "@/types/config/provider"
import { omit, pick } from "@/types/utils"
import { getLobeIconsCDNUrlFn } from "../logo"

export const DEFAULT_LLM_PROVIDER_MODELS: LLMProviderModels = {
  "openrouter": {
    model: "x-ai/grok-4-fast:free",
    isCustomModel: false,
    customModel: null,
  },
  "atlascloud": {
    model: "deepseek-ai/deepseek-v4-flash",
    isCustomModel: false,
    customModel: null,
  },
  "openai-compatible": {
    model: "use-custom-model",
    isCustomModel: true,
    customModel: null,
  },
  "openai": {
    model: "gpt-5.4-mini",
    isCustomModel: false,
    customModel: null,
  },
  "azure": {
    model: "gpt-5.4-mini",
    isCustomModel: false,
    customModel: null,
  },
  "deepseek": {
    model: "deepseek-v4-flash",
    isCustomModel: false,
    customModel: null,
  },
  "google": {
    model: "gemini-2.5-flash-lite",
    isCustomModel: false,
    customModel: null,
  },
  "anthropic": {
    model: "claude-haiku-4-5",
    isCustomModel: false,
    customModel: null,
  },
  "xai": {
    model: "grok-4.20-0309-non-reasoning",
    isCustomModel: false,
    customModel: null,
  },
  "bedrock": {
    model: "us.amazon.nova-micro-v1:0",
    isCustomModel: false,
    customModel: null,
  },
  "groq": {
    model: "llama-3.1-8b-instant",
    isCustomModel: false,
    customModel: null,
  },
  "deepinfra": {
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    isCustomModel: false,
    customModel: null,
  },
  "mistral": {
    model: "magistral-small-2507",
    isCustomModel: false,
    customModel: null,
  },
  "togetherai": {
    model: "deepseek-ai/DeepSeek-V3",
    isCustomModel: false,
    customModel: null,
  },
  "cohere": {
    model: "command-r7b-12-2024",
    isCustomModel: false,
    customModel: null,
  },
  "fireworks": {
    model: "accounts/fireworks/models/llama-v3p2-3b-instruct",
    isCustomModel: false,
    customModel: null,
  },
  "cerebras": {
    model: "llama3.1-8b",
    isCustomModel: false,
    customModel: null,
  },
  "replicate": {
    model: "meta/meta-llama-3.1-70b-instruct",
    isCustomModel: false,
    customModel: null,
  },
  "perplexity": {
    model: "sonar",
    isCustomModel: false,
    customModel: null,
  },
  "vercel": {
    model: "v0-1.5-md",
    isCustomModel: false,
    customModel: null,
  },
  "ollama": {
    model: "gemma3:4b",
    isCustomModel: false,
    customModel: null,
  },
  "siliconflow": {
    model: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    isCustomModel: true,
    customModel: null,
  },
  "tensdaq": {
    model: "Qwen3-30B-A3B-Instruct-2507",
    isCustomModel: true,
    customModel: null,
  },
  "volcengine": {
    model: "doubao-seed-1-6-flash-250828",
    isCustomModel: true,
    customModel: null,
  },
  "minimax": {
    model: "MiniMax-M2.7",
    isCustomModel: false,
    customModel: null,
  },
  "alibaba": {
    model: "qwen3.5-flash",
    isCustomModel: false,
    customModel: null,
  },
  "moonshotai": {
    model: "kimi-k2-turbo",
    isCustomModel: false,
    customModel: null,
  },
  "huggingface": {
    model: "meta-llama/Llama-3.1-8B-Instruct",
    isCustomModel: false,
    customModel: null,
  },
}

export const PROVIDER_ITEMS: Record<AllProviderTypes, { logo: (theme: Theme) => string, name: string, website: string, sponsor?: ProviderSponsorConfig }>
  = {
    "microsoft-translate": {
      logo: getLobeIconsCDNUrlFn("microsoft-color"),
      name: NON_API_TRANSLATE_PROVIDERS_MAP["microsoft-translate"],
      website: "https://translator.microsoft.com",
    },
    "google-translate": {
      logo: getLobeIconsCDNUrlFn("google-color"),
      name: NON_API_TRANSLATE_PROVIDERS_MAP["google-translate"],
      website: "https://translate.google.com",
    },
    "deeplx": {
      logo: (theme: Theme) => theme === "light" ? deeplxLogoLight : deeplxLogoDark,
      name: "DeepLX",
      website: "https://deeplx.owo.network/",
    },
    "deepl": {
      logo: (theme: Theme) => theme === "light" ? deeplxLogoLight : deeplxLogoDark,
      name: "DeepL",
      website: "https://www.deepl.com/pro-api",
    },
    "atlascloud": {
      logo: getLobeIconsCDNUrlFn("atlascloud"),
      name: "Atlas Cloud",
      website: "https://readfrog.s.gy/altas",
      sponsor: {
        sponsoring: true,
        referUrl: "https://readfrog.s.gy/altas",
      },
    },
    "openai-compatible": {
      logo: () => customProviderLogo,
      name: "Custom Provider",
      website: `${env.WXT_WEBSITE_URL}/docs/providers/openai-compatible-providers`,
    },
    "openrouter": {
      logo: getLobeIconsCDNUrlFn("openrouter"),
      name: "OpenRouter",
      website: "https://openrouter.ai/",
    },
    "minimax": {
      logo: getLobeIconsCDNUrlFn("minimax-color"),
      name: "MiniMax",
      website: "https://platform.minimax.io",
    },
    "siliconflow": {
      logo: getLobeIconsCDNUrlFn("siliconcloud-color"),
      name: "SiliconFlow",
      website: "https://siliconflow.cn/",
    },
    "openai": {
      logo: getLobeIconsCDNUrlFn("openai"),
      name: "OpenAI",
      website: "https://platform.openai.com",
    },
    "azure": {
      logo: getLobeIconsCDNUrlFn("azure-color"),
      name: "Azure",
      website: "https://azure.microsoft.com/products/ai-services/openai-service",
    },
    "deepseek": {
      logo: getLobeIconsCDNUrlFn("deepseek-color"),
      name: "DeepSeek",
      website: "https://platform.deepseek.com",
    },
    "google": {
      logo: getLobeIconsCDNUrlFn("gemini-color"),
      name: "Gemini",
      website: "https://aistudio.google.com",
    },
    "anthropic": {
      logo: getLobeIconsCDNUrlFn("anthropic"),
      name: "Anthropic",
      website: "https://console.anthropic.com",
    },
    "xai": {
      logo: getLobeIconsCDNUrlFn("grok"),
      name: "Grok",
      website: "https://x.ai/api",
    },
    "bedrock": {
      logo: getLobeIconsCDNUrlFn("bedrock-color"),
      name: "Amazon Bedrock",
      website: "https://aws.amazon.com/bedrock/",
    },
    "groq": {
      logo: getLobeIconsCDNUrlFn("groq"),
      name: "Groq",
      website: "https://groq.com",
    },
    "deepinfra": {
      logo: getLobeIconsCDNUrlFn("deepinfra-color"),
      name: "DeepInfra",
      website: "https://deepinfra.com",
    },
    "mistral": {
      logo: getLobeIconsCDNUrlFn("mistral-color"),
      name: "Mistral AI",
      website: "https://mistral.ai",
    },
    "togetherai": {
      logo: getLobeIconsCDNUrlFn("together-color"),
      name: "Together.ai",
      website: "https://together.ai",
    },
    "cohere": {
      logo: getLobeIconsCDNUrlFn("cohere-color"),
      name: "Cohere",
      website: "https://cohere.com",
    },
    "fireworks": {
      logo: getLobeIconsCDNUrlFn("fireworks-color"),
      name: "Fireworks AI",
      website: "https://fireworks.ai",
    },
    "cerebras": {
      logo: getLobeIconsCDNUrlFn("cerebras-color"),
      name: "Cerebras",
      website: "https://cerebras.ai",
    },
    "replicate": {
      logo: getLobeIconsCDNUrlFn("replicate"),
      name: "Replicate",
      website: "https://replicate.com",
    },
    "perplexity": {
      logo: getLobeIconsCDNUrlFn("perplexity-color"),
      name: "Perplexity",
      website: "https://perplexity.ai",
    },
    "vercel": {
      logo: getLobeIconsCDNUrlFn("vercel"),
      name: "Vercel",
      website: "https://vercel.com",
    },
    "tensdaq": {
      logo: () => tensdaqLogoColor,
      name: "Tensdaq",
      website: "https://dashboard.x-aio.com/zh/register?ref=c356c1daba9a4641a18e",
    },
    "ollama": {
      logo: getLobeIconsCDNUrlFn("ollama"),
      name: "Ollama",
      website: "https://ollama.ai",
    },
    "volcengine": {
      logo: getLobeIconsCDNUrlFn("volcengine-color"),
      name: "Volcengine",
      website: "https://www.volcengine.com/product/doubao",
    },
    "alibaba": {
      logo: getLobeIconsCDNUrlFn("bailian-color"),
      name: "Alibaba Cloud",
      website: "https://modelstudio.alibabacloud.com/",
    },
    "moonshotai": {
      logo: getLobeIconsCDNUrlFn("moonshot"),
      name: "Moonshot AI",
      website: "https://platform.moonshot.cn/",
    },
    "huggingface": {
      logo: getLobeIconsCDNUrlFn("huggingface-color"),
      name: "Hugging Face",
      website: "https://huggingface.co/",
    },
  }

export const DEFAULT_PROVIDER_CONFIG = {
  "google-translate": {
    id: "google-translate-default",
    name: PROVIDER_ITEMS["google-translate"].name,
    enabled: true,
    provider: "google-translate",
  },
  "microsoft-translate": {
    id: "microsoft-translate-default",
    name: PROVIDER_ITEMS["microsoft-translate"].name,
    enabled: true,
    provider: "microsoft-translate",
  },
  "atlascloud": {
    id: "atlascloud-default",
    name: PROVIDER_ITEMS.atlascloud.name,
    enabled: true,
    provider: "atlascloud",
    baseURL: "https://api.atlascloud.ai/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS.atlascloud,
  },
  "siliconflow": {
    id: "siliconflow-default",
    name: PROVIDER_ITEMS.siliconflow.name,
    enabled: true,
    provider: "siliconflow",
    baseURL: "https://api.siliconflow.cn/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS.siliconflow,
  },
  "tensdaq": {
    id: "tensdaq-default",
    name: PROVIDER_ITEMS.tensdaq.name,
    enabled: true,
    provider: "tensdaq",
    baseURL: "https://tensdaq-api.x-aio.com/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS.tensdaq,
  },
  "openai-compatible": {
    id: "openai-compatible-default",
    name: PROVIDER_ITEMS["openai-compatible"].name,
    enabled: true,
    provider: "openai-compatible",
    baseURL: "https://api.example.com/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS["openai-compatible"],
  },
  "openai": {
    id: "openai-default",
    name: PROVIDER_ITEMS.openai.name,
    enabled: true,
    provider: "openai",
    model: DEFAULT_LLM_PROVIDER_MODELS.openai,
    reasoning: "none",
  },
  "azure": {
    id: "azure-default",
    name: PROVIDER_ITEMS.azure.name,
    enabled: true,
    provider: "azure",
    model: DEFAULT_LLM_PROVIDER_MODELS.azure,
    providerSpecificSettings: {
      apiMode: "responses",
      apiVersion: "v1",
    },
  },
  "deepseek": {
    id: "deepseek-default",
    name: PROVIDER_ITEMS.deepseek.name,
    enabled: true,
    provider: "deepseek",
    model: DEFAULT_LLM_PROVIDER_MODELS.deepseek,
    reasoning: "none",
  },
  "google": {
    id: "google-default",
    name: PROVIDER_ITEMS.google.name,
    enabled: true,
    provider: "google",
    model: DEFAULT_LLM_PROVIDER_MODELS.google,
    reasoning: "none",
  },
  "anthropic": {
    id: "anthropic-default",
    name: PROVIDER_ITEMS.anthropic.name,
    enabled: true,
    provider: "anthropic",
    model: DEFAULT_LLM_PROVIDER_MODELS.anthropic,
    reasoning: "none",
  },
  "xai": {
    id: "xai-default",
    name: PROVIDER_ITEMS.xai.name,
    enabled: true,
    provider: "xai",
    model: DEFAULT_LLM_PROVIDER_MODELS.xai,
    reasoning: "none",
  },
  "deeplx": {
    id: "deeplx-default",
    name: PROVIDER_ITEMS.deeplx.name,
    enabled: true,
    provider: "deeplx",
    baseURL: "https://api.deeplx.org/{{apiKey}}/translate",
  },
  "deepl": {
    id: "deepl-default",
    name: PROVIDER_ITEMS.deepl.name,
    enabled: true,
    provider: "deepl",
  },
  "bedrock": {
    id: "bedrock-default",
    name: PROVIDER_ITEMS.bedrock.name,
    enabled: true,
    provider: "bedrock",
    model: DEFAULT_LLM_PROVIDER_MODELS.bedrock,
    reasoning: "none",
    providerSpecificSettings: { region: "us-east-1" },
  },
  "groq": {
    id: "groq-default",
    name: PROVIDER_ITEMS.groq.name,
    enabled: true,
    provider: "groq",
    model: DEFAULT_LLM_PROVIDER_MODELS.groq,
    reasoning: "none",
  },
  "deepinfra": {
    id: "deepinfra-default",
    name: PROVIDER_ITEMS.deepinfra.name,
    enabled: true,
    provider: "deepinfra",
    model: DEFAULT_LLM_PROVIDER_MODELS.deepinfra,
  },
  "mistral": {
    id: "mistral-default",
    name: PROVIDER_ITEMS.mistral.name,
    enabled: true,
    provider: "mistral",
    model: DEFAULT_LLM_PROVIDER_MODELS.mistral,
  },
  "togetherai": {
    id: "togetherai-default",
    name: PROVIDER_ITEMS.togetherai.name,
    enabled: true,
    provider: "togetherai",
    model: DEFAULT_LLM_PROVIDER_MODELS.togetherai,
  },
  "cohere": {
    id: "cohere-default",
    name: PROVIDER_ITEMS.cohere.name,
    enabled: true,
    provider: "cohere",
    model: DEFAULT_LLM_PROVIDER_MODELS.cohere,
  },
  "fireworks": {
    id: "fireworks-default",
    name: PROVIDER_ITEMS.fireworks.name,
    enabled: true,
    provider: "fireworks",
    model: DEFAULT_LLM_PROVIDER_MODELS.fireworks,
    reasoning: "none",
  },
  "cerebras": {
    id: "cerebras-default",
    name: PROVIDER_ITEMS.cerebras.name,
    enabled: true,
    provider: "cerebras",
    model: DEFAULT_LLM_PROVIDER_MODELS.cerebras,
  },
  "replicate": {
    id: "replicate-default",
    name: PROVIDER_ITEMS.replicate.name,
    enabled: true,
    provider: "replicate",
    model: DEFAULT_LLM_PROVIDER_MODELS.replicate,
  },
  "perplexity": {
    id: "perplexity-default",
    name: PROVIDER_ITEMS.perplexity.name,
    enabled: true,
    provider: "perplexity",
    model: DEFAULT_LLM_PROVIDER_MODELS.perplexity,
  },
  "vercel": {
    id: "vercel-default",
    name: PROVIDER_ITEMS.vercel.name,
    enabled: true,
    provider: "vercel",
    model: DEFAULT_LLM_PROVIDER_MODELS.vercel,
  },
  "openrouter": {
    id: "openrouter-default",
    name: PROVIDER_ITEMS.openrouter.name,
    enabled: true,
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS.openrouter,
  },
  "ollama": {
    id: "ollama-default",
    name: PROVIDER_ITEMS.ollama.name,
    enabled: true,
    provider: "ollama",
    model: DEFAULT_LLM_PROVIDER_MODELS.ollama,
  },
  "volcengine": {
    id: "volcengine-default",
    name: PROVIDER_ITEMS.volcengine.name,
    enabled: true,
    provider: "volcengine",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: DEFAULT_LLM_PROVIDER_MODELS.volcengine,
  },
  "minimax": {
    id: "minimax-default",
    name: PROVIDER_ITEMS.minimax.name,
    enabled: true,
    provider: "minimax",
    baseURL: "https://api.minimax.io/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS.minimax,
  },
  "alibaba": {
    id: "alibaba-default",
    name: PROVIDER_ITEMS.alibaba.name,
    enabled: true,
    provider: "alibaba",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: DEFAULT_LLM_PROVIDER_MODELS.alibaba,
  },
  "moonshotai": {
    id: "moonshotai-default",
    name: PROVIDER_ITEMS.moonshotai.name,
    enabled: true,
    provider: "moonshotai",
    model: DEFAULT_LLM_PROVIDER_MODELS.moonshotai,
  },
  "huggingface": {
    id: "huggingface-default",
    name: PROVIDER_ITEMS.huggingface.name,
    enabled: true,
    provider: "huggingface",
    model: DEFAULT_LLM_PROVIDER_MODELS.huggingface,
  },
} as const satisfies Record<AllProviderTypes, ProviderConfig>

export const PROVIDER_BASE_URL_PLACEHOLDERS: Partial<Record<APIProviderTypes, string>> = {
  "atlascloud": DEFAULT_PROVIDER_CONFIG.atlascloud.baseURL,
  "siliconflow": DEFAULT_PROVIDER_CONFIG.siliconflow.baseURL,
  "tensdaq": DEFAULT_PROVIDER_CONFIG.tensdaq.baseURL,
  "openai-compatible": DEFAULT_PROVIDER_CONFIG["openai-compatible"].baseURL,
  "openai": "https://api.openai.com/v1",
  "azure": "https://<resource>.services.ai.azure.com/openai",
  "deepseek": "https://api.deepseek.com",
  "google": "https://generativelanguage.googleapis.com/v1beta",
  "anthropic": "https://api.anthropic.com/v1",
  "xai": "https://api.x.ai/v1",
  "deeplx": DEFAULT_PROVIDER_CONFIG.deeplx.baseURL,
  "bedrock": "https://bedrock-runtime.us-east-1.amazonaws.com",
  "groq": "https://api.groq.com/openai/v1",
  "deepinfra": "https://api.deepinfra.com/v1",
  "mistral": "https://api.mistral.ai/v1",
  "togetherai": "https://api.together.xyz/v1",
  "cohere": "https://api.cohere.com/v2",
  "fireworks": "https://api.fireworks.ai/inference/v1",
  "cerebras": "https://api.cerebras.ai/v1",
  "replicate": "https://api.replicate.com/v1",
  "perplexity": "https://api.perplexity.ai",
  "vercel": "https://api.v0.dev/v1",
  "openrouter": "https://openrouter.ai/api/v1",
  "ollama": "http://127.0.0.1:11434/",
  "volcengine": DEFAULT_PROVIDER_CONFIG.volcengine.baseURL,
  "minimax": DEFAULT_PROVIDER_CONFIG.minimax.baseURL,
  "alibaba": DEFAULT_PROVIDER_CONFIG.alibaba.baseURL,
  "moonshotai": "https://api.moonshot.ai/v1",
  "huggingface": "https://router.huggingface.co/v1",
}

export const DEFAULT_PROVIDER_CONFIG_LIST: ProvidersConfig = [
  DEFAULT_PROVIDER_CONFIG["microsoft-translate"],
  DEFAULT_PROVIDER_CONFIG["google-translate"],
  DEFAULT_PROVIDER_CONFIG.openai,
  DEFAULT_PROVIDER_CONFIG.deepseek,
  DEFAULT_PROVIDER_CONFIG.atlascloud,
]

export const NON_API_TRANSLATE_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  NON_API_TRANSLATE_PROVIDERS,
)

export const TRANSLATE_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  TRANSLATE_PROVIDER_TYPES,
)

export const PURE_TRANSLATE_PROVIDER_ITEMS = pick(
  TRANSLATE_PROVIDER_ITEMS,
  PURE_TRANSLATE_PROVIDERS,
)

export const LLM_PROVIDER_ITEMS = omit(
  TRANSLATE_PROVIDER_ITEMS,
  PURE_TRANSLATE_PROVIDERS,
)

export const API_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  API_PROVIDER_TYPES,
)

export const PROVIDER_GROUPS = {
  builtInProviders: {
    types: NON_CUSTOM_LLM_PROVIDER_TYPES,
    tutorialSlug: "built-in-providers",
  },
  openaiCompatibleProviders: {
    types: CUSTOM_LLM_PROVIDER_TYPES,
    tutorialSlug: "openai-compatible-providers",
  },
  pureTranslationProviders: {
    types: PURE_API_PROVIDER_TYPES,
    tutorialSlug: "pure-translation-providers",
  },
} as const satisfies Record<string, { types: readonly APIProviderTypes[], tutorialSlug: string }>

export const SPECIFIC_TUTORIAL_PROVIDER_TYPES = ["ollama", "deeplx", "deepl"] as const satisfies readonly APIProviderTypes[]
