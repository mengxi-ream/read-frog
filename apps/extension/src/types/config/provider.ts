import { z } from 'zod'
import { HOTKEYS } from '@/utils/constants/hotkeys'

/* ──────────────────────────────
  Single source of truth
  ────────────────────────────── */
export const readProviderModels = {
  openai: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-nano'],
  deepseek: ['deepseek-chat'],
} as const
export const translateProviderModels = {
  openai: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-nano'],
  deepseek: ['deepseek-chat'],
  openrouter: ['meta-llama/llama-4-maverick:free', 'deepseek/deepseek-chat-v3-0324:free', 'deepseek/deepseek-prover-v2:free'],
  ollama: ['deepseek-r1:8b', 'gemma3:1b', 'qwen3:0.6b', 'qwen3:8b', 'gemma3:latest', 'llama3.1:8b'],
} as const
export const pureTranslateProvider = ['google', 'microsoft'] as const

/* ──────────────────────────────
  Derived provider names
  ────────────────────────────── */

// read provider names
export const readProviderNames = ['openai', 'deepseek'] as const satisfies Readonly<
  (keyof typeof readProviderModels)[]
>
export type ReadProviderNames = typeof readProviderNames[number]
// translate provider names
export const translateProviderNames = ['google', 'microsoft', 'openai', 'deepseek', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof translateProviderModels | typeof pureTranslateProvider[number])[]
>
export type TranslateProviderNames = typeof translateProviderNames[number]
// translate provider names that support LLM
export const llmTranslateProviderNames = ['openai', 'deepseek', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof translateProviderModels)[]
>
export type LLMTranslateProviderNames = typeof llmTranslateProviderNames[number]
export function isLLMTranslateProvider(provider: TranslateProviderNames): provider is LLMTranslateProviderNames {
  return llmTranslateProviderNames.includes(provider as LLMTranslateProviderNames)
}

// all provider names
export const allProviderNames = ['openai', 'deepseek', 'google', 'microsoft', 'openrouter', 'ollama'] as const satisfies Readonly<
  (typeof readProviderNames[number] | typeof translateProviderNames[number])[]
>
export type AllProviderNames = typeof allProviderNames[number]

// need to be set api key for LLM
export const apiProviderNames = ['openai', 'deepseek', 'openrouter', 'ollama'] as const satisfies Readonly<
  (keyof typeof readProviderModels | keyof typeof translateProviderModels)[]
>
export type APIProviderNames = typeof apiProviderNames[number]

/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */

const providerConfigItemSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
})

export const providersConfigSchema = z.object(
  apiProviderNames.reduce((acc, provider) => {
    acc[provider] = providerConfigItemSchema
    return acc
  }, {} as Record<typeof apiProviderNames[number], typeof providerConfigItemSchema>),
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

export const readModelsSchema = buildModelSchema(readProviderModels)
export type ReadModels = z.infer<typeof readModelsSchema>

export const readConfigSchema = z.object({
  provider: z.enum(readProviderNames),
  models: readModelsSchema,
})
export type ReadConfig = z.infer<typeof readConfigSchema>

/* ──────────────────────────────
  translate config
  ────────────────────────────── */

export const translateLLMModelsSchema = buildModelSchema(translateProviderModels)
export type TranslateLLMModels = z.infer<typeof translateLLMModelsSchema>

export const pureTranslateModelsSchema = z.object(
  pureTranslateProvider.reduce((acc, provider) => {
    acc[provider] = z.null()
    return acc
  }, {} as Record<typeof pureTranslateProvider[number], z.ZodNull>),
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

export const translateConfigSchema = z.object({
  provider: z.enum(translateProviderNames),
  models: translateModelsSchema,
  node: z.object({
    enabled: z.boolean(),
    hotkey: z.enum(HOTKEYS),
  }),
  page: z.object({
    range: pageTranslateRangeSchema,
    autoTranslatePatterns: z.array(z.string()),
  }),
})
export type TranslateConfig = z.infer<typeof translateConfigSchema>

/* ──────────────────────────────
  type guard functions
  ────────────────────────────── */

export function isPureTranslateProvider(provider: TranslateProviderNames): provider is typeof pureTranslateProvider[number] {
  return pureTranslateProvider.includes(provider as typeof pureTranslateProvider[number])
}
