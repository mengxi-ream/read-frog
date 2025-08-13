import { z } from 'zod'
import { HOTKEYS } from '@/utils/constants/hotkeys'
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from '@/utils/constants/translate'
import { TRANSLATION_NODE_STYLE } from '@/utils/constants/translation-node-style'
/* ──────────────────────────────
  Single source of truth
  ────────────────────────────── */
export const READ_PROVIDER_MODELS = {
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
} as const
export const TRANSLATE_PROVIDER_MODELS = {
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5-nano', 'gpt-4.1-nano', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
} as const
export const PURE_TRANSLATE_PROVIDERS = ['google', 'microsoft', 'deeplx'] as const

export const THINKING_MODELS = ['gemini-2.5-pro', 'gemini-1.5-pro'] as const

/* ──────────────────────────────
  Derived provider names
  ────────────────────────────── */

// read provider names
export const READ_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini'] as const satisfies Readonly<
  (keyof typeof READ_PROVIDER_MODELS)[]
>
export type ReadProviderNames = typeof READ_PROVIDER_NAMES[number]
// translate provider names
export const TRANSLATE_PROVIDER_NAMES = ['google', 'microsoft', 'deeplx', 'openai', 'deepseek', 'gemini'] as const satisfies Readonly<
  (keyof typeof TRANSLATE_PROVIDER_MODELS | typeof PURE_TRANSLATE_PROVIDERS[number])[]
>
export type TranslateProviderNames = typeof TRANSLATE_PROVIDER_NAMES[number]
// translate provider names that support LLM
export const LLM_TRANSLATE_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini'] as const satisfies Readonly<
  (keyof typeof TRANSLATE_PROVIDER_MODELS)[]
>
export type LLMTranslateProviderNames = typeof LLM_TRANSLATE_PROVIDER_NAMES[number]
export function isLLMTranslateProvider(provider: TranslateProviderNames): provider is LLMTranslateProviderNames {
  return LLM_TRANSLATE_PROVIDER_NAMES.includes(provider as LLMTranslateProviderNames)
}

// all provider names
export const ALL_PROVIDER_NAMES = ['openai', 'deepseek', 'google', 'microsoft', 'deeplx', 'gemini'] as const satisfies Readonly<
  (typeof READ_PROVIDER_NAMES[number] | typeof TRANSLATE_PROVIDER_NAMES[number])[]
>
export type AllProviderNames = typeof ALL_PROVIDER_NAMES[number]

// need to be set api key for LLM
export const API_PROVIDER_NAMES = ['openai', 'deepseek', 'gemini', 'deeplx'] as const satisfies Readonly<
  (keyof typeof READ_PROVIDER_MODELS | keyof typeof TRANSLATE_PROVIDER_MODELS | 'deeplx')[]
>
export type APIProviderNames = typeof API_PROVIDER_NAMES[number]
export function isAPIProvider(provider: TranslateProviderNames): provider is APIProviderNames {
  return API_PROVIDER_NAMES.includes(provider as APIProviderNames)
}

/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */

const providerConfigItemSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
})

export const providersConfigSchema = z.object(
  API_PROVIDER_NAMES.reduce((acc, provider) => {
    acc[provider] = providerConfigItemSchema
    return acc
  }, {} as Record<typeof API_PROVIDER_NAMES[number], typeof providerConfigItemSchema>),
)

export type ProvidersConfig = z.infer<typeof providersConfigSchema>

/* ──────────────────────────────
  read or translate config helpers
  ────────────────────────────── */

type ModelTuple = readonly [string, ...string[]] // 至少一个元素才能给 z.enum
function providerConfigSchema<T extends ModelTuple>(models: T) {
  return z.object({
    model: z.enum(models),
    isCustomModel: z.boolean(),
    customModel: z.string().optional(),
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

export const readModelsSchema = buildModelSchema(READ_PROVIDER_MODELS)
export type ReadModels = z.infer<typeof readModelsSchema>

export const readConfigSchema = z.object({
  provider: z.enum(READ_PROVIDER_NAMES),
  models: readModelsSchema,
})
export type ReadConfig = z.infer<typeof readConfigSchema>

/* ──────────────────────────────
  translate config
  ────────────────────────────── */

export const translateLLMModelsSchema = buildModelSchema(TRANSLATE_PROVIDER_MODELS)
export type TranslateLLMModels = z.infer<typeof translateLLMModelsSchema>

export const pureTranslateModelsSchema = z.object(
  PURE_TRANSLATE_PROVIDERS.reduce((acc, provider) => {
    acc[provider] = z.null()
    return acc
  }, {} as Record<typeof PURE_TRANSLATE_PROVIDERS[number], z.ZodNull>),
)
export type PureTranslateModels = z.infer<typeof pureTranslateModelsSchema>

export const translateModelsSchema = z.object({
  ...pureTranslateModelsSchema.shape,
  ...translateLLMModelsSchema.shape,
})
export type TranslateModels = z.infer<typeof translateModelsSchema>

// TODO: add "article" as a range
export const pageTranslateRangeSchema = z.enum(['main', 'all'])
export type PageTranslateRange = z.infer<typeof pageTranslateRangeSchema>

export const translationNodeStyleSchema = z.enum(TRANSLATION_NODE_STYLE)
export type TranslationNodeStyle = z.infer<typeof translationNodeStyleSchema>

export const translatePromptObjSchema = z.object({
  name: z.string(),
  id: z.string(),
  prompt: z.string(),
})
export type TranslatePromptObj = z.infer<typeof translatePromptObjSchema>

export const promptsConfigSchema = z.object({
  prompt: z.string(),
  patterns: z.array(
    translatePromptObjSchema,
  ),
})

export const requestQueueConfigSchema = z.object({
  capacity: z.number().gte(MIN_TRANSLATE_CAPACITY),
  rate: z.number().gte(MIN_TRANSLATE_RATE),
})

export const translateConfigSchema = z.object({
  provider: z.enum(TRANSLATE_PROVIDER_NAMES),
  models: translateModelsSchema,
  node: z.object({
    enabled: z.boolean(),
    hotkey: z.enum(HOTKEYS),
  }),
  page: z.object({
    range: pageTranslateRangeSchema,
    autoTranslatePatterns: z.array(z.string()),
  }),
  promptsConfig: promptsConfigSchema,
  requestQueueConfig: requestQueueConfigSchema,
  translationNodeStyle: translationNodeStyleSchema,
})
export type RequestQueueConfig = z.infer<typeof requestQueueConfigSchema>
export type TranslateConfig = z.infer<typeof translateConfigSchema>

/* ──────────────────────────────
  type guard functions
  ────────────────────────────── */

export function isPureTranslateProvider(provider: TranslateProviderNames): provider is typeof PURE_TRANSLATE_PROVIDERS[number] {
  return PURE_TRANSLATE_PROVIDERS.includes(provider as typeof PURE_TRANSLATE_PROVIDERS[number])
}
