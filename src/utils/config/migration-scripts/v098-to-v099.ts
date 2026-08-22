/**
 * Migration script from v098 to v099.
 *
 * Gives every API provider that has no description the default one for its type.
 *
 * A provider's description is not a stored default: outside migrations it is resolved from i18n
 * at the moment the provider is created and then persisted, which is why fresh installs and
 * providers added from the options page have one. A migration cannot do that — it may not import
 * the i18n facade, and it runs before any i18n bootstrap in the background — so the provider
 * v098 seeded for existing users (Jalapeno Cloud) reached them with an empty description box
 * while new installs saw the blurb. Same for anything a user added before descriptions were
 * persisted at all.
 *
 * The text is English for everyone. Translating it would mean carrying all nine locales plus a
 * copy of the "auto" locale resolution in here, and freezing that copy the day this file is
 * written; the description stays editable, so a user who wants their own wording has it.
 *
 * An empty description is treated as no description: the field is an override, and a provider
 * showing nothing is the state this repairs, however it got there.
 *
 * NOTE for future migrations: a migration that seeds a provider should put a `description` in
 * its literal, English and inline like these. Nothing backfills it afterwards.
 *
 * Idempotent: a provider that already has a description is returned untouched, and the whole
 * config is returned by identity when nothing needs filling.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

// The English descriptions as they stand in v099's locale file, copied out rather than referenced.
const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  "openai-compatible":
    "Connect to a custom endpoint compatible with the OpenAI Chat Completions API",
  "open-responses": "Connect to a custom endpoint compatible with the Open Responses API",
  jalapenocloud: "Enterprise-grade AI used by top teams — now made for you!",
  atlascloud:
    "Unified OpenAI-compatible access to newer DeepSeek, Kimi, Qwen, Doubao, GLM, and other models",
  openrouter: "Unified interface for multiple LLM providers with pay-per-use pricing",
  minimax: "MiniMax AI platform offering advanced MiniMax-M2 models for text generation",
  siliconflow: "High-performance inference platform for Chinese and international models",
  tensdaq:
    "Revolutionary bidding AI MaaS platform with market-driven pricing, eliminating high-cost fixed pricing",
  volcengine: "ByteDance's cloud AI platform offering Doubao models for translation and reading",
  openai: "Provides models like GPT-4o",
  deepseek: "Recommend to use in China",
  google: "Google's flagship AI models with advanced reasoning capabilities",
  anthropic: "Claude models known for safety and reasoning excellence",
  xai: "Elon Musk's AI company offering Grok models with real-time data access",
  deeplx: "Unofficial DeepL API",
  deepl: "Official DeepL API",
  azure: "Azure-hosted OpenAI models through your deployments",
  bedrock: "AWS managed service for enterprise-grade foundation models",
  groq: "Specialized hardware for ultra-fast LLM inference speeds",
  deepinfra: "Cost-effective cloud inference for popular open-source models",
  mistral: "European AI company specializing in efficient multilingual models",
  togetherai: "Collaborative platform for running and fine-tuning open-source models",
  cohere: "Enterprise-focused AI with strong multilingual and RAG capabilities",
  fireworks: "Production-ready inference platform for open-source models",
  cerebras: "Ultra-fast AI inference for rapid translation and text analysis",
  replicate: "Access to diverse open-source models for specialized translation tasks",
  perplexity: "Real-time knowledge-enhanced AI for contextual translations and reading assistance",
  vercel: "Optimized AI models for web content translation and analysis",
  ollama: "Run large language models locally on your machine for complete privacy",
  alibaba:
    "Alibaba Cloud's Qwen model series with advanced reasoning and multilingual capabilities",
  moonshotai: "Moonshot AI's Kimi model series with strong reasoning and long-context capabilities",
  huggingface: "Hugging Face Inference API providing access to thousands of open-source models",
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig) || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  let changed = false
  const providersConfig = oldConfig.providersConfig.map((providerConfig: any) => {
    if (!isObject(providerConfig) || providerConfig.description) {
      return providerConfig
    }

    const description = PROVIDER_DESCRIPTIONS[providerConfig.provider]
    if (!description) {
      return providerConfig
    }

    changed = true
    return { ...providerConfig, description }
  })

  if (!changed) {
    return oldConfig
  }

  return { ...oldConfig, providersConfig }
}
