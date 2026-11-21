/**
 * Migration script from v128 to v129.
 *
 * Moves saved provider configs off models that were dropped from the built-in
 * model lists because the provider shut them down (or does so by 2026-11-30),
 * onto the replacement the provider recommends where that model is still
 * listed, and otherwise onto a listed model of the same size class:
 * - OpenAI: gpt-4.1-nano and the gpt-5*-chat-latest / gpt-5*-codex ids.
 * - Anthropic: claude-opus-4-0, claude-sonnet-4-0, claude-opus-4-1 (retired)
 *   and claude-sonnet-4-5 (retires 2026-11-30).
 * - Google: gemini-3-pro-preview, gemini-3.1-flash-lite-preview,
 *   gemini-2.0-flash and the two image previews. The image previews' own
 *   successors are image models, so they go to the default text model.
 * - Moonshot AI: the Moonshot V1 series and the deprecated Kimi K2 models.
 *   kimi-k2.6 is still served and is kept.
 * - DeepSeek: deepseek-v4-flash. V4 Flash is retired and the name only
 *   temporarily routes to V4.1 Flash, which deepseek-flash serves. Unlike the
 *   others it is still listed in v129, because it was the default and a UI
 *   context can read a not-yet-migrated config, so it is moved before DeepSeek
 *   stops routing it rather than after it is dropped.
 * - Groq: every chat model except gpt-oss-20b/120b and qwen3.8-27b.
 * - Cerebras: every model except gpt-oss-120b.
 * - Mistral: zai-glm-5-2, the Magistral and Mistral Medium snapshots,
 *   Pixtral and the open-* models. Dated snapshots go to the matching
 *   `-latest` alias.
 *
 * Two shapes are moved, as in v119-to-v120:
 * - Custom-model mode is on and `customModel` is a removed id. Ticking "enter
 *   custom model" copies the selected id into `customModel`, and requests go
 *   to `customModel`, so leaving it would keep calling the dead model. The
 *   provider goes back onto the selector with the replacement
 *   (`isCustomModel: false`, `customModel: null`).
 * - Otherwise, `model.model` is a removed id. Only that field is rewritten,
 *   whatever `isCustomModel` says, because the schema validates it against the
 *   model list even when a custom model is in use. A custom model the user
 *   typed that is not a removed id is kept: it may be a private deployment.
 *
 * A config with nothing to move (including a second run) is returned by
 * identity. Malformed shapes are left for the schema parse that follows.
 *
 * IMPORTANT: This is a frozen snapshot. All model ids are hardcoded inline;
 * it imports nothing from the evolving application code.
 */

const REPLACEMENTS: Record<string, Readonly<Record<string, string>>> = {
  openai: {
    "gpt-4.1-nano": "gpt-5.6-luna",
    "gpt-5-chat-latest": "gpt-5.6-sol",
    "gpt-5.1-chat-latest": "gpt-5.6-sol",
    "gpt-5.2-chat-latest": "gpt-5.6-sol",
    "gpt-5.3-chat-latest": "gpt-5.6-sol",
    "gpt-5-codex": "gpt-5.6-sol",
    "gpt-5.1-codex": "gpt-5.6-sol",
    "gpt-5.1-codex-mini": "gpt-5.6-terra",
  },
  anthropic: {
    "claude-opus-4-0": "claude-opus-4-8",
    "claude-opus-4-1": "claude-opus-4-8",
    "claude-sonnet-4-0": "claude-sonnet-5-5",
    "claude-sonnet-4-5": "claude-sonnet-5-5",
  },
  google: {
    "gemini-3-pro-preview": "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite",
    "gemini-2.0-flash": "gemini-3.6-flash",
    "gemini-3.1-flash-image-preview": "gemini-3.5-flash-lite",
    "gemini-3-pro-image-preview": "gemini-3.5-flash-lite",
  },
  moonshotai: {
    "moonshot-v1-8k": "kimi-k3",
    "moonshot-v1-32k": "kimi-k3",
    "moonshot-v1-128k": "kimi-k3",
    "kimi-k2": "kimi-k3",
    "kimi-k2.5": "kimi-k3",
    "kimi-k2-thinking": "kimi-k3",
    "kimi-k2-thinking-turbo": "kimi-k3",
    "kimi-k2-turbo": "kimi-k3",
  },
  deepseek: {
    "deepseek-v4-flash": "deepseek-flash",
  },
  groq: {
    "gemma2-9b-it": "openai/gpt-oss-20b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "llama3-8b-8192": "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama3-70b-8192": "openai/gpt-oss-120b",
    "deepseek-r1-distill-llama-70b": "openai/gpt-oss-120b",
    "deepseek-r1-distill-qwen-32b": "openai/gpt-oss-120b",
    "meta-llama/llama-4-maverick-17b-128e-instruct": "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct": "openai/gpt-oss-120b",
    "moonshotai/kimi-k2-instruct-0905": "openai/gpt-oss-120b",
    "mixtral-8x7b-32768": "openai/gpt-oss-120b",
    "qwen/qwen3-32b": "openai/gpt-oss-120b",
    "qwen-qwq-32b": "openai/gpt-oss-120b",
    "qwen-2.5-32b": "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b": "qwen/qwen3.8-27b",
  },
  cerebras: {
    "gemma-4-31b": "gpt-oss-120b",
    "llama3.1-8b": "gpt-oss-120b",
    "llama-3.3-70b": "gpt-oss-120b",
    "qwen-3-32b": "gpt-oss-120b",
    "qwen-3-235b-a22b-instruct-2507": "gpt-oss-120b",
    "qwen-3-235b-a22b-thinking-2507": "gpt-oss-120b",
    "zai-glm-4.6": "gpt-oss-120b",
    "zai-glm-4.7": "gpt-oss-120b",
  },
  mistral: {
    "zai-glm-5-2": "zai-glm-5-3",
    "mistral-medium-2505": "mistral-medium-latest",
    "mistral-medium-2508": "mistral-medium-latest",
    "magistral-medium-2506": "mistral-medium-latest",
    "magistral-medium-2507": "mistral-medium-latest",
    "pixtral-large-latest": "mistral-medium-latest",
    "magistral-small-2506": "mistral-small-latest",
    "magistral-small-2507": "mistral-small-latest",
    "open-mixtral-8x7b": "mistral-small-latest",
    "open-mixtral-8x22b": "mistral-small-latest",
    "pixtral-12b-2409": "ministral-14b-latest",
    "open-mistral-7b": "ministral-8b-latest",
  },
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function replacementFor(replacements: Readonly<Record<string, string>>, id: string) {
  return Object.hasOwn(replacements, id) ? replacements[id] : undefined
}

// `customModel` is free text, so match it the way a user may have typed it.
function customModelReplacement(
  replacements: Readonly<Record<string, string>>,
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const id = value.trim().toLowerCase()
  if (id === "") {
    return undefined
  }
  const removed = Object.keys(replacements).find((model) => model.toLowerCase() === id)
  return removed === undefined ? undefined : replacements[removed]
}

function migrateProvider(provider: unknown): unknown {
  if (
    !isObject(provider) ||
    typeof provider.provider !== "string" ||
    !Object.hasOwn(REPLACEMENTS, provider.provider) ||
    !isObject(provider.model)
  ) {
    return provider
  }

  const replacements = REPLACEMENTS[provider.provider]!
  const model = provider.model

  if (model.isCustomModel === true) {
    const replacement = customModelReplacement(replacements, model.customModel)
    if (replacement !== undefined) {
      return {
        ...provider,
        model: { ...model, model: replacement, isCustomModel: false, customModel: null },
      }
    }
  }

  const replacement =
    typeof model.model === "string" ? replacementFor(replacements, model.model) : undefined
  if (replacement !== undefined) {
    return { ...provider, model: { ...model, model: replacement } }
  }

  return provider
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig) || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  const providersConfig = oldConfig.providersConfig.map(migrateProvider)
  if (providersConfig.every((provider, index) => provider === oldConfig.providersConfig[index])) {
    return oldConfig
  }

  return { ...oldConfig, providersConfig }
}
