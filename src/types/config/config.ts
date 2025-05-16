import { z } from 'zod'

import { langCodeISO6393, langLevel } from '@/types/config/languages'
import { HOTKEYS } from '@/utils/constants/config'
import { MIN_SIDE_CONTENT_WIDTH } from '@/utils/constants/side'

import {
  providerSchema,
  providersConfigSchema,
  translateProviderSchema,
} from './provider'

const hotkey = z.enum(HOTKEYS)
export type Hotkey = (typeof HOTKEYS)[number]

// Language schema
const languageSchema = z.object({
  detectedCode: langCodeISO6393,
  sourceCode: langCodeISO6393.or(z.literal('auto')),
  targetCode: langCodeISO6393,
  level: langLevel,
})

// Node translate schema
const nodeTranslateSchema = z.object({
  enabled: z.boolean(),
  hotkey,
})

// Floating button schema
const floatingButtonSchema = z.object({
  enabled: z.boolean(),
  position: z.number().min(0).max(1),
})

// side content schema
const sideContentSchema = z.object({
  width: z.number().min(MIN_SIDE_CONTENT_WIDTH),
})

// page translate schema
// TODO: add "article" as a range
export const pageTranslateRangeSchema = z.enum(['main', 'all'])
export type PageTranslateRange = z.infer<typeof pageTranslateRangeSchema>

const pageTranslateSchema = z.object({
  range: pageTranslateRangeSchema,
})

// Translate schema
const translateSchema = z.object({
  provider: translateProviderSchema,
  node: nodeTranslateSchema,
  page: pageTranslateSchema,
})

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  provider: providerSchema,
  providersConfig: providersConfigSchema,
  translate: translateSchema,
  floatingButton: floatingButtonSchema,
  sideContent: sideContentSchema,
})

export type Config = z.infer<typeof configSchema>
