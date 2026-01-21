import { langCodeISO6393Schema, langLevel } from '@read-frog/definitions'

import { z } from 'zod'
import { MIN_SIDE_CONTENT_WIDTH } from '@/utils/constants/side'
import { isReadProvider, isTranslateProvider, isTTSProvider, NON_API_TRANSLATE_PROVIDERS_MAP, providersConfigSchema } from './provider'
import { readConfigSchema } from './read'
import { videoSubtitlesSchema } from './subtitles'
import { translateConfigSchema } from './translate'
import { ttsConfigSchema } from './tts'
// Language schema
const languageSchema = z.object({
  sourceCode: langCodeISO6393Schema.or(z.literal('auto')),
  targetCode: langCodeISO6393Schema,
  level: langLevel,
})

// Floating button schema
const floatingButtonSchema = z.object({
  enabled: z.boolean(),
  position: z.number().min(0).max(1),
  disabledFloatingButtonPatterns: z.array(z.string()),
  clickAction: z.enum(['panel', 'translate']),
})

// Text selection button schema
const selectionToolbarSchema = z.object({
  enabled: z.boolean(),
  disabledSelectionToolbarPatterns: z.array(z.string()),
})

// side content schema
const sideContentSchema = z.object({
  width: z.number().min(MIN_SIDE_CONTENT_WIDTH),
})

// beta experience schema
const betaExperienceSchema = z.object({
  enabled: z.boolean(),
})

// context menu schema
const contextMenuSchema = z.object({
  enabled: z.boolean(),
})

// input translation language selector: 'sourceCode', 'targetCode', or fixed language code
const inputTranslationLangSchema = z.union([
  z.literal('sourceCode'),
  z.literal('targetCode'),
  langCodeISO6393Schema,
])

// input translation schema (triple-space trigger)
const inputTranslationSchema = z.object({
  enabled: z.boolean(),
  fromLang: inputTranslationLangSchema,
  toLang: inputTranslationLangSchema,
  enableCycle: z.boolean(),
  timeThreshold: z.number().min(100).max(1000),
})

// Export types for use in components
export type InputTranslationLang = z.infer<typeof inputTranslationLangSchema>

// site control schema
const siteControlSchema = z.object({
  mode: z.enum(['all', 'whitelist']),
  patterns: z.array(z.string()),
})

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  providersConfig: providersConfigSchema,
  read: readConfigSchema,
  translate: translateConfigSchema,
  tts: ttsConfigSchema,
  floatingButton: floatingButtonSchema,
  selectionToolbar: selectionToolbarSchema,
  sideContent: sideContentSchema,
  betaExperience: betaExperienceSchema,
  contextMenu: contextMenuSchema,
  inputTranslation: inputTranslationSchema,
  videoSubtitles: videoSubtitlesSchema,
  siteControl: siteControlSchema,
}).superRefine((data, ctx) => {
  const providerIdsSet = new Set(data.providersConfig.map(p => p.id))
  const providerIds = Array.from(providerIdsSet)

  if (!providerIdsSet.has(data.read.providerId)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: providerIds,
      message: `Invalid provider id "${data.read.providerId}". Must be one of: ${providerIds.join(', ')}`,
      path: ['read', 'providerId'],
    })
  }
  const readProvider = data.providersConfig.find(p => p.id === data.read.providerId)
  if (readProvider && !isReadProvider(readProvider.provider)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: providerIds,
      message: `Invalid provider id "${data.read.providerId}". Must be a read provider`,
      path: ['read', 'providerId'],
    })
  }

  const validTranslateProviders = [...providerIds, ...Object.values(NON_API_TRANSLATE_PROVIDERS_MAP)]
  const validTranslateProvidersSet = new Set(validTranslateProviders)

  if (!validTranslateProvidersSet.has(data.translate.providerId)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: validTranslateProviders,
      message: `Invalid provider id "${data.translate.providerId}". Must be one of: ${validTranslateProviders.join(', ')}`,
      path: ['translate', 'providerId'],
    })
  }
  const translateProvider = data.providersConfig.find(p => p.id === data.translate.providerId)
  if (translateProvider && !isTranslateProvider(translateProvider.provider)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: validTranslateProviders,
      message: `Invalid provider id "${data.translate.providerId}". Must be a translate provider`,
      path: ['translate', 'providerId'],
    })
  }

  if (data.tts.providerId && !providerIdsSet.has(data.tts.providerId)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: providerIds,
      message: `Invalid provider id "${data.tts.providerId}". Must be one of: ${providerIds.join(', ')}`,
      path: ['tts', 'provider'],
    })
  }
  const ttsProvider = data.providersConfig.find(p => p.id === data.tts.providerId)
  if (ttsProvider && !isTTSProvider(ttsProvider.provider)) {
    ctx.addIssue({
      code: 'invalid_value',
      values: providerIds,
      message: `Invalid provider id "${data.tts.providerId}". Must be a tts provider`,
      path: ['tts', 'provider'],
    })
  }
})

export type Config = z.infer<typeof configSchema>
