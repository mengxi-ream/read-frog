import { langCodeISO6393Schema } from '@repo/definitions'
import { z } from 'zod'
import { HOTKEYS } from '@/utils/constants/hotkeys'
import { MIN_BATCH_CHARACTERS, MIN_BATCH_SIZE, MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from '@/utils/constants/translate'
import { TRANSLATION_NODE_STYLE } from '@/utils/constants/translation-node-style'

export const requestQueueConfigSchema = z.object({
  capacity: z.number().gte(MIN_TRANSLATE_CAPACITY),
  rate: z.number().gte(MIN_TRANSLATE_RATE),
})

export const requestBatchConfigSchema = z.object({
  batchCharacters: z.number().gte(MIN_BATCH_CHARACTERS),
  batchSize: z.number().gte(MIN_BATCH_SIZE),
})

export const TRANSLATION_MODES = ['bilingual', 'translationOnly'] as const
export const translationModeSchema = z.enum(TRANSLATION_MODES)

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
  // TODO: change this `prompt` to `promptName`?
  prompt: z.string(),
  patterns: z.array(
    translatePromptObjSchema,
  ),
})

export const translateConfigSchema = z.object({
  providerId: z.string().nonempty(),
  mode: translationModeSchema,
  node: z.object({
    enabled: z.boolean(),
    hotkey: z.enum(HOTKEYS),
  }),
  page: z.object({
    range: pageTranslateRangeSchema,
    autoTranslatePatterns: z.array(z.string()),
    autoTranslateLanguages: z.array(langCodeISO6393Schema),
  }),
  promptsConfig: promptsConfigSchema,
  requestQueueConfig: requestQueueConfigSchema,
  requestBatchConfig: requestBatchConfigSchema,
  translationNodeStyle: translationNodeStyleSchema,
  customAutoTranslateShortcutKey: z.array(z.string()),
})

export type RequestQueueConfig = z.infer<typeof requestQueueConfigSchema>
export type RequestBatchConfig = z.infer<typeof requestBatchConfigSchema>
export type TranslateConfig = z.infer<typeof translateConfigSchema>
export type TranslationMode = z.infer<typeof translationModeSchema>
