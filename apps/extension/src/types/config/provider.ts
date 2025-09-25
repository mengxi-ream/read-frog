import { z } from 'zod'
/* ──────────────────────────────
  Single source of truth
  ────────────────────────────── */
export const READ_PROVIDER_MODELS = {
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  siliconflow: ['Qwen/Qwen3-Next-80B-A3B-Instruct'],
  tensdaq: ['Qwen3-235B-A22B-Instruct-2507', 'Qwen3-235B-A22B-Thinking-2507'],
  ai302: ['gpt-4.1-mini', 'qwen3-235b-a22b'],
  openaiCompatible: ['use-custom-model'],
  grok: ['grok-4', 'grok-3'],
  amazonBedrock: ['anthropic.claude-3-5-sonnet-20241022-v2:0', 'anthropic.claude-3-5-haiku-20241022-v1:0', 'meta.llama3-1-405b-instruct-v1:0'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
  deepinfra: ['meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.1-405B-Instruct'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  togetherai: ['meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'],
  cohere: ['command-r-plus', 'command-r', 'command'],
  fireworks: ['accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct'],
  cerebras: ['llama-3.3-70b', 'llama3.1-8b'],
  replicate: ['meta/meta-llama-3.1-405b-instruct', 'meta/meta-llama-3.1-70b-instruct', 'meta/meta-llama-3.1-8b-instruct'],
  perplexity: ['sonar-pro', 'sonar'],
  vercel: ['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md'],
  openrouter: ['deepseek/deepseek-chat-v3.1:free', 'openai/gpt-4.1-mini'],
  ollama: ['gemma3:27b', 'deepseek-v3'],
} as const
export const TRANSLATE_PROVIDER_MODELS = {
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5-nano', 'gpt-4.1-nano', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
  anthropic: ['claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'],
  siliconflow: ['Qwen/Qwen3-Next-80B-A3B-Instruct'],
  tensdaq: ['Qwen3-30B-A3B-Instruct-2507'],
  ai302: ['gpt-4.1-mini', 'qwen3-235b-a22b'],
  openaiCompatible: ['use-custom-model'],
  grok: ['grok-3-mini', 'grok-3-mini-fast'],
  amazonBedrock: ['anthropic.claude-3-5-haiku-20241022-v1:0', 'anthropic.claude-3-haiku-20240307-v1:0', 'meta.llama3-1-70b-instruct-v1:0'],
  groq: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  deepinfra: ['meta-llama/Llama-3.1-70B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct'],
  mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  togetherai: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
  cohere: ['command-r', 'command-r-plus', 'command'],
  fireworks: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct'],
  cerebras: ['llama3.1-8b'],
  replicate: ['meta/meta-llama-3.1-70b-instruct', 'meta/meta-llama-3.1-8b-instruct'],
  perplexity: ['sonar-pro'],
  vercel: ['v0-1.5-md', 'v0-1.0-md'],
  openrouter: ['x-ai/grok-4-fast:free', 'openai/gpt-4.1-mini'],
  ollama: ['gemma3:4b', 'llama3.2:3b'],
} as const
export const NON_API_TRANSLATE_PROVIDERS = ['google', 'microsoft'] as const
export const NON_API_TRANSLATE_PROVIDERS_MAP: Record<typeof NON_API_TRANSLATE_PROVIDERS[number], string> = {
  google: 'Google Translate',
  microsoft: 'Microsoft Translator',
}
export const PURE_TRANSLATE_PROVIDERS = ['google', 'microsoft', 'deeplx'] as const

export const THINKING_MODELS = ['gemini-2.5-pro', 'gemini-1.5-pro'] as const

/* ──────────────────────────────
  Derived provider names
  ────────────────────────────── */

// read provider names
export const READ_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'openaiCompatible', 'siliconflow', 'tensdaq', 'ai302', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof READ_PROVIDER_MODELS)[]
>
export type ReadProviderNames = typeof READ_PROVIDER_NAMES[number]
export function isReadProvider(provider: string): provider is ReadProviderNames {
  return READ_PROVIDER_NAMES.includes(provider as ReadProviderNames)
}
export function isReadProviderConfig(config: ProviderConfig): config is ReadProviderConfig {
  return isReadProvider(config.provider)
}

// translate provider names
export const TRANSLATE_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx', 'openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'openaiCompatible', 'siliconflow', 'tensdaq', 'ai302', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof TRANSLATE_PROVIDER_MODELS | typeof PURE_TRANSLATE_PROVIDERS[number])[]
>
export type TranslateProviderNames = typeof TRANSLATE_PROVIDER_NAMES[number]
export function isTranslateProvider(provider: string): provider is TranslateProviderNames {
  return TRANSLATE_PROVIDER_NAMES.includes(provider as TranslateProviderNames)
}
export function isTranslateProviderConfig(config: ProviderConfig): config is TranslateProviderConfig {
  return isTranslateProvider(config.provider)
}

// translate provider names that support LLM
export const LLM_TRANSLATE_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'openaiCompatible', 'siliconflow', 'tensdaq', 'ai302', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof TRANSLATE_PROVIDER_MODELS)[]
>
export type LLMTranslateProviderNames = typeof LLM_TRANSLATE_PROVIDER_NAMES[number]
export function isLLMTranslateProvider(provider: string): provider is LLMTranslateProviderNames {
  return LLM_TRANSLATE_PROVIDER_NAMES.includes(provider as LLMTranslateProviderNames)
}
export function isLLMTranslateProviderConfig(config: ProviderConfig): config is LLMTranslateProviderConfig {
  return isLLMTranslateProvider(config.provider)
}

export const LLM_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'openaiCompatible', 'siliconflow', 'tensdaq', 'ai302', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof READ_PROVIDER_MODELS | keyof typeof TRANSLATE_PROVIDER_MODELS)[]
>
export type LLMProviderNames = typeof LLM_PROVIDER_NAMES[number]
export function isLLMProvider(provider: string): provider is LLMProviderNames {
  return LLM_PROVIDER_NAMES.includes(provider as LLMProviderNames)
}
export function isLLMProviderConfig(config: ProviderConfig): config is LLMProviderConfig {
  return isLLMProvider(config.provider)
}

export const CUSTOM_LLM_PROVIDER_NAMES = ['openaiCompatible', 'tensdaq', 'siliconflow', 'ai302'] as const satisfies Readonly<
(keyof typeof READ_PROVIDER_MODELS | keyof typeof TRANSLATE_PROVIDER_MODELS)[]
>
export type CustomLLMProviderNames = typeof CUSTOM_LLM_PROVIDER_NAMES[number]
export function isCustomLLMProvider(provider: string): provider is CustomLLMProviderNames {
  return CUSTOM_LLM_PROVIDER_NAMES.includes(provider as CustomLLMProviderNames)
}
export function isCustomLLMProviderConfig(config: ProviderConfig): config is CustomLLMProviderConfig {
  return isCustomLLMProvider(config.provider)
}

export const NON_CUSTOM_LLM_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  Exclude<keyof typeof READ_PROVIDER_MODELS | keyof typeof TRANSLATE_PROVIDER_MODELS, CustomLLMProviderNames>[]
>
export type NonCustomLLMProviderNames = typeof NON_CUSTOM_LLM_PROVIDER_NAMES[number]
export function isNonCustomLLMProvider(provider: string): provider is NonCustomLLMProviderNames {
  return NON_CUSTOM_LLM_PROVIDER_NAMES.includes(provider as NonCustomLLMProviderNames)
}
export function isNonCustomLLMProviderConfig(config: ProviderConfig): config is NonCustomLLMProviderConfig {
  return isNonCustomLLMProvider(config.provider)
}

export const API_PROVIDER_NAMES = ['siliconflow', 'tensdaq', 'ai302', 'openaiCompatible', 'openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'deeplx', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof READ_PROVIDER_MODELS | keyof typeof TRANSLATE_PROVIDER_MODELS | 'deeplx')[]
>
export type APIProviderNames = typeof API_PROVIDER_NAMES[number]
export function isAPIProvider(provider: string): provider is APIProviderNames {
  return API_PROVIDER_NAMES.includes(provider as APIProviderNames)
}
export function isAPIProviderConfig(config: ProviderConfig): config is APIProviderConfig {
  return isAPIProvider(config.provider)
}

export const PURE_API_PROVIDER_NAMES = ['deeplx'] as const satisfies Readonly<
  Exclude<APIProviderNames, LLMTranslateProviderNames>[]
>
export type PureAPIProviderNames = typeof PURE_API_PROVIDER_NAMES[number]
export function isPureAPIProvider(provider: string): provider is PureAPIProviderNames {
  return PURE_API_PROVIDER_NAMES.includes(provider as PureAPIProviderNames)
}
export function isPureAPIProviderConfig(config: ProviderConfig): config is PureAPIProviderConfig {
  return isPureAPIProvider(config.provider)
}

export type NonAPIProviderNames = typeof NON_API_TRANSLATE_PROVIDERS[number]
export function isNonAPIProvider(provider: string): provider is NonAPIProviderNames {
  return NON_API_TRANSLATE_PROVIDERS.includes(provider as NonAPIProviderNames)
}
export function isNonAPIProviderConfig(config: ProviderConfig): config is NonAPIProviderConfig {
  return isNonAPIProvider(config.provider)
}

// all provider names
export const ALL_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx', 'siliconflow', 'tensdaq', 'ai302', 'openaiCompatible', 'openai', 'deepseek', 'gemini', 'anthropic', 'grok', 'amazonBedrock', 'groq', 'deepinfra', 'mistral', 'togetherai', 'cohere', 'fireworks', 'cerebras', 'replicate', 'perplexity', 'vercel', 'openrouter', 'ollama'] as const satisfies Readonly<
  (typeof READ_PROVIDER_NAMES[number] | typeof TRANSLATE_PROVIDER_NAMES[number])[]
>
export type AllProviderNames = typeof ALL_PROVIDER_NAMES[number]

export function isPureTranslateProvider(provider: TranslateProviderNames): provider is typeof PURE_TRANSLATE_PROVIDERS[number] {
  return PURE_TRANSLATE_PROVIDERS.includes(provider as typeof PURE_TRANSLATE_PROVIDERS[number])
}

/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */

// Helper function to create provider-specific models schema
function createProviderModelsSchema<T extends LLMTranslateProviderNames | ReadProviderNames>(provider: T) {
  const readModels = isReadProvider(provider) ? READ_PROVIDER_MODELS[provider] : []
  const translateModels = isLLMTranslateProvider(provider) ? TRANSLATE_PROVIDER_MODELS[provider] : []

  return z.object({
    read: z.object({
      model: z.enum(readModels),
      isCustomModel: z.boolean(),
      customModel: z.string().nullable(),
    }),
    translate: z.object({
      model: z.enum(translateModels),
      isCustomModel: z.boolean(),
      customModel: z.string().nullable(),
    }),
  })
}

// Base schema without models
export const baseProviderConfigSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  description: z.string().optional(),
  enabled: z.boolean(),
})

export const baseAPIProviderConfigSchema = baseProviderConfigSchema.extend({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
})

export const baseCustomLLMProviderConfigSchema = baseAPIProviderConfigSchema.extend({
  baseURL: z.string(),
})

const llmProviderConfigSchemaList = [
  baseCustomLLMProviderConfigSchema.extend({
    provider: z.literal('siliconflow'),
    models: createProviderModelsSchema<'siliconflow'>('siliconflow'),
  }),
  baseCustomLLMProviderConfigSchema.extend({
    provider: z.literal('tensdaq'),
    models: createProviderModelsSchema<'tensdaq'>('tensdaq'),
  }),
  baseCustomLLMProviderConfigSchema.extend({
    provider: z.literal('ai302'),
    models: createProviderModelsSchema<'ai302'>('ai302'),
  }),
  baseCustomLLMProviderConfigSchema.extend({
    provider: z.literal('openaiCompatible'),
    models: z.object({
      read: z.object({
        model: z.enum(READ_PROVIDER_MODELS.openaiCompatible),
        isCustomModel: z.literal(true),
        customModel: z.string().nullable(),
      }),
      translate: z.object({
        model: z.enum(TRANSLATE_PROVIDER_MODELS.openaiCompatible),
        isCustomModel: z.literal(true),
        customModel: z.string().nullable(),
      }),
    }),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('openai'),
    models: createProviderModelsSchema<'openai'>('openai'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('deepseek'),
    models: createProviderModelsSchema<'deepseek'>('deepseek'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('gemini'),
    models: createProviderModelsSchema<'gemini'>('gemini'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('anthropic'),
    models: createProviderModelsSchema<'anthropic'>('anthropic'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('grok'),
    models: createProviderModelsSchema<'grok'>('grok'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('amazonBedrock'),
    models: createProviderModelsSchema<'amazonBedrock'>('amazonBedrock'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('groq'),
    models: createProviderModelsSchema<'groq'>('groq'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('deepinfra'),
    models: createProviderModelsSchema<'deepinfra'>('deepinfra'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('mistral'),
    models: createProviderModelsSchema<'mistral'>('mistral'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('togetherai'),
    models: createProviderModelsSchema<'togetherai'>('togetherai'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('cohere'),
    models: createProviderModelsSchema<'cohere'>('cohere'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('fireworks'),
    models: createProviderModelsSchema<'fireworks'>('fireworks'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('cerebras'),
    models: createProviderModelsSchema<'cerebras'>('cerebras'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('replicate'),
    models: createProviderModelsSchema<'replicate'>('replicate'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('perplexity'),
    models: createProviderModelsSchema<'perplexity'>('perplexity'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('vercel'),
    models: createProviderModelsSchema<'vercel'>('vercel'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('openrouter'),
    models: createProviderModelsSchema<'openrouter'>('openrouter'),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('ollama'),
    models: createProviderModelsSchema<'ollama'>('ollama'),
  }),
] as const

const apiProviderConfigSchemaList = [
  ...llmProviderConfigSchemaList,
  baseAPIProviderConfigSchema.extend({
    provider: z.literal('deeplx'),
  }),
] as const

export const providerConfigSchemaList = [
  ...apiProviderConfigSchemaList,
  baseProviderConfigSchema.extend({
    provider: z.literal('google'),
  }),
  baseProviderConfigSchema.extend({
    provider: z.literal('microsoft'),
  }),
] as const

export const llmProviderConfigItemSchema = z.discriminatedUnion('provider', llmProviderConfigSchemaList)
export const apiProviderConfigItemSchema = z.discriminatedUnion('provider', apiProviderConfigSchemaList)
export const providerConfigItemSchema = z.discriminatedUnion('provider', providerConfigSchemaList)

export const providersConfigSchema = z.array(providerConfigItemSchema).superRefine(
  (providers, ctx) => {
    const idSet = new Set<string>()
    providers.forEach((provider, index) => {
      if (idSet.has(provider.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate provider id "${provider.id}"`,
          path: [index, 'id'],
        })
      }
      idSet.add(provider.id)
    })

    const nameSet = new Set<string>()
    providers.forEach((provider, index) => {
      if (nameSet.has(provider.name)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate provider name "${provider.name}"`,
          path: [index, 'name'],
        })
      }
      nameSet.add(provider.name)
    })
  },
)
export type ProvidersConfig = z.infer<typeof providersConfigSchema>
export type ProviderConfig = ProvidersConfig[number]
export type NonAPIProviderConfig = Extract<ProviderConfig, { provider: NonAPIProviderNames }>
export type PureProviderConfig = Extract<ProviderConfig, { provider: PureAPIProviderNames }>
export type APIProviderConfig = Extract<ProviderConfig, { provider: APIProviderNames }>
export type PureAPIProviderConfig = Extract<ProviderConfig, { provider: PureAPIProviderNames }>
export type LLMTranslateProviderConfig = Extract<ProviderConfig, { provider: LLMTranslateProviderNames }>
export type LLMProviderConfig = Extract<ProviderConfig, { provider: LLMProviderNames }>
export type TranslateProviderConfig = Extract<ProviderConfig, { provider: TranslateProviderNames }>
export type ReadProviderConfig = Extract<ProviderConfig, { provider: ReadProviderNames }>
export type NonCustomLLMProviderConfig = Extract<ProviderConfig, { provider: NonCustomLLMProviderNames }>
export type CustomLLMProviderConfig = Extract<ProviderConfig, { provider: CustomLLMProviderNames }>

/* ──────────────────────────────
  read or translate config helpers
  ────────────────────────────── */

type ModelTuple = readonly [string, ...string[]] // 至少一个元素才能给 z.enum
function providerConfigSchema<T extends ModelTuple>(models: T) {
  return z.object({
    model: z.enum(models),
    isCustomModel: z.boolean(),
    customModel: z.string().nullable(),
  })
}

type SchemaShape<M extends Record<string, ModelTuple>> = {
  [K in keyof M]: ReturnType<typeof providerConfigSchema<M[K]>>;
}

function buildModelSchema<M extends Record<string, ModelTuple>>(models: M) {
  return z.object(
    // 用 reduce 而不用 Object.fromEntries ➙ 保留键名/类型
    (Object.keys(models) as (keyof M)[]).reduce((acc, key) => {
      acc[key] = providerConfigSchema(models[key])
      return acc
    }, {} as SchemaShape<M>),
  )
}

/* ──────────────────────────────
  read config
  ────────────────────────────── */

const { openaiCompatible: _, ollama: _ollama, ...readModelsWithoutOpenaiCompatibleAndOllama } = READ_PROVIDER_MODELS
export const readModelsSchema = buildModelSchema(readModelsWithoutOpenaiCompatibleAndOllama).extend({
  openaiCompatible: z.object({
    model: z.enum(READ_PROVIDER_MODELS.openaiCompatible),
    isCustomModel: z.literal(true),
    customModel: z.string().nullable(),
  }),
  ollama: z.object({
    model: z.enum(READ_PROVIDER_MODELS.ollama),
    isCustomModel: z.boolean(),
    customModel: z.string().nullable(),
  }),
})
export type ReadModels = z.infer<typeof readModelsSchema>

/* ──────────────────────────────
  translate config
  ────────────────────────────── */

const { openaiCompatible: __, ollama: _ollama2, ...translateModelsWithoutOpenaiCompatibleAndOllama } = TRANSLATE_PROVIDER_MODELS
export const translateLLMModelsSchema = buildModelSchema(translateModelsWithoutOpenaiCompatibleAndOllama).extend({
  openaiCompatible: z.object({
    model: z.enum(TRANSLATE_PROVIDER_MODELS.openaiCompatible),
    isCustomModel: z.literal(true),
    customModel: z.string().nullable(),
  }),
  ollama: z.object({
    model: z.enum(TRANSLATE_PROVIDER_MODELS.ollama),
    isCustomModel: z.boolean(),
    customModel: z.string().nullable(),
  }),
})
export type TranslateLLMModels = z.infer<typeof translateLLMModelsSchema>
