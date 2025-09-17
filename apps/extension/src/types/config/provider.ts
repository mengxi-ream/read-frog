import { z } from 'zod'
/* ──────────────────────────────
  Single source of truth
  ────────────────────────────── */
export const READ_PROVIDER_MODELS = {
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  openaiCompatible: ['use-custom-model'],
} as const
export const TRANSLATE_PROVIDER_MODELS = {
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5-nano', 'gpt-4.1-nano', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
  openaiCompatible: ['use-custom-model'],
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
export const READ_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'openaiCompatible'] as const satisfies Readonly<
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
export const TRANSLATE_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx', 'openai', 'deepseek', 'gemini', 'openaiCompatible'] as const satisfies Readonly<
  (keyof typeof TRANSLATE_PROVIDER_MODELS | typeof PURE_TRANSLATE_PROVIDERS[number])[]
>
export type TranslateProviderNames = typeof TRANSLATE_PROVIDER_NAMES[number]
export function isTranslateProvider(provider: TranslateProviderNames): provider is TranslateProviderNames {
  return TRANSLATE_PROVIDER_NAMES.includes(provider as TranslateProviderNames)
}

// translate provider names that support LLM
export const LLM_TRANSLATE_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'openaiCompatible'] as const satisfies Readonly<
  (keyof typeof TRANSLATE_PROVIDER_MODELS)[]
>
export type LLMTranslateProviderNames = typeof LLM_TRANSLATE_PROVIDER_NAMES[number]
export function isLLMTranslateProvider(provider: TranslateProviderNames): provider is LLMTranslateProviderNames {
  return LLM_TRANSLATE_PROVIDER_NAMES.includes(provider as LLMTranslateProviderNames)
}
export function isLLMTranslateProviderConfig(config: ProviderConfig): config is LLMTranslateProviderConfig {
  return isLLMTranslateProvider(config.provider)
}

export const API_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'openaiCompatible', 'deeplx'] as const satisfies Readonly<
  (keyof typeof READ_PROVIDER_MODELS | keyof typeof TRANSLATE_PROVIDER_MODELS | 'deeplx')[]
>
export type APIProviderNames = typeof API_PROVIDER_NAMES[number]
export function isAPIProvider(provider: TranslateProviderNames): provider is APIProviderNames {
  return API_PROVIDER_NAMES.includes(provider as APIProviderNames)
}
export function isAPIProviderConfig(config: ProviderConfig): config is APIProviderConfig {
  return isAPIProvider(config.provider)
}

export const PURE_API_PROVIDER_NAMES = ['deeplx'] as const satisfies Readonly<
  Exclude<APIProviderNames, LLMTranslateProviderNames>[]
>
export type PureAPIProviderNames = typeof PURE_API_PROVIDER_NAMES[number]
export function isPureAPIProvider(provider: TranslateProviderNames): provider is PureAPIProviderNames {
  return PURE_API_PROVIDER_NAMES.includes(provider as PureAPIProviderNames)
}
export function isPureAPIProviderConfig(config: ProviderConfig): config is PureAPIProviderConfig {
  return isPureAPIProvider(config.provider)
}

export type NonAPIProviderNames = typeof NON_API_TRANSLATE_PROVIDERS[number]
export function isNonAPIProvider(provider: TranslateProviderNames): provider is NonAPIProviderNames {
  return NON_API_TRANSLATE_PROVIDERS.includes(provider as NonAPIProviderNames)
}
export function isNonAPIProviderConfig(config: ProviderConfig): config is NonAPIProviderConfig {
  return isNonAPIProvider(config.provider)
}

// all provider names
export const ALL_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx', 'openai', 'deepseek', 'gemini', 'openaiCompatible'] as const satisfies Readonly<
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

const llmProviderConfigSchemaList = [
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
    provider: z.literal('openaiCompatible'),
    baseURL: z.string(), // required for openaiCompatible
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
export type ReadProviderConfig = Extract<ProviderConfig, { provider: ReadProviderNames }>

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

const { openaiCompatible: _, ...readModelsWithoutOpenaiCompatible } = READ_PROVIDER_MODELS
export const readModelsSchema = buildModelSchema(readModelsWithoutOpenaiCompatible).extend({
  openaiCompatible: z.object({
    model: z.enum(READ_PROVIDER_MODELS.openaiCompatible),
    isCustomModel: z.literal(true),
    customModel: z.string().nullable(),
  }),
})
export type ReadModels = z.infer<typeof readModelsSchema>

/* ──────────────────────────────
  translate config
  ────────────────────────────── */

const { openaiCompatible: __, ...translateModelsWithoutOpenaiCompatible } = TRANSLATE_PROVIDER_MODELS
export const translateLLMModelsSchema = buildModelSchema(translateModelsWithoutOpenaiCompatible).extend({
  openaiCompatible: z.object({
    model: z.enum(TRANSLATE_PROVIDER_MODELS.openaiCompatible),
    isCustomModel: z.literal(true),
    customModel: z.string().nullable(),
  }),
})
export type TranslateLLMModels = z.infer<typeof translateLLMModelsSchema>
