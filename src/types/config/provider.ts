import { z } from 'zod'
import { HOTKEYS } from '@/utils/constants/config'

/* ──────────────────────────────
  Single source of truth
  ────────────────────────────── */
export const readProviderModels = {
  openai: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-nano'],
  deepseek: ['deepseek-chat'],
  openrouter: ['deepseek/deepseek-chat-v3-0324:free', 'qwen/qwen3-235b-a22b:free'],
} as const
export const translateProviderModels = {
  openai: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-nano'],
  deepseek: ['deepseek-chat'],
  openrouter: ['meta-llama/llama-4-maverick:free', 'deepseek/deepseek-chat-v3-0324:free', 'deepseek/deepseek-prover-v2:free'],
} as const
export const pureTranslateProvider = ['google', 'microsoft'] as const

export const apiProviderNames = ['openai', 'deepseek', 'openrouter'] as const

/* ──────────────────────────────
  Derived provider names
  ────────────────────────────── */

export const readProviderNames = ['openai', 'deepseek', 'openrouter'] as const satisfies Readonly<
  (keyof typeof readProviderModels)[]
>
export const translateProviderNames = ['google', 'microsoft', 'openai', 'deepseek', 'openrouter'] as const satisfies Readonly<
  (keyof typeof translateProviderModels | typeof pureTranslateProvider[number])[]
>

/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */

const providerConfigItemSchema = z.object({
  apiKey: z.string().optional(),
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

export const readModelSchema = buildModelSchema(readProviderModels)
export type ReadModel = z.infer<typeof readModelSchema>

export const readConfigSchema = z.object({
  provider: z.enum(apiProviderNames),
  models: readModelSchema,
})
export type ReadConfig = z.infer<typeof readConfigSchema>

/* ──────────────────────────────
  translate config
  ────────────────────────────── */

export const translateModelSchema = buildModelSchema(translateProviderModels)
export type TranslateModel = z.infer<typeof translateModelSchema>

export const pureTranslateModelSchema = z.object(
  pureTranslateProvider.reduce((acc, provider) => {
    acc[provider] = z.null()
    return acc
  }, {} as Record<typeof pureTranslateProvider[number], z.ZodNull>),
)
export type PureTranslateModel = z.infer<typeof pureTranslateModelSchema>

// TODO: add "article" as a range
export const pageTranslateRangeSchema = z.enum(['main', 'all'])

export const translateConfigSchema = z.object({
  provider: z.enum(translateProviderNames),
  models: z.object({
    ...pureTranslateModelSchema.shape,
    ...translateModelSchema.shape,
  }),
  node: z.object({
    enabled: z.boolean(),
    hotkey: z.enum(HOTKEYS),
  }),
  page: z.object({
    range: pageTranslateRangeSchema,
  }),
})
export type TranslateConfig = z.infer<typeof translateConfigSchema>
