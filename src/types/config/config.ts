import { z } from 'zod'

import { langCodeISO6393, langLevel } from '@/types/config/languages'
import { MIN_SIDE_CONTENT_WIDTH } from '@/utils/constants/side'
import { providersConfigSchema, readConfigSchema, translateConfigSchema } from './provider'

// Language schema
const languageSchema = z.object({
  detectedCode: langCodeISO6393,
  sourceCode: langCodeISO6393.or(z.literal('auto')),
  targetCode: langCodeISO6393,
  level: langLevel,
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

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  providersConfig: providersConfigSchema,
  read: readConfigSchema,
  translate: translateConfigSchema,
  floatingButton: floatingButtonSchema,
  sideContent: sideContentSchema,
})

export type Config = z.infer<typeof configSchema>
