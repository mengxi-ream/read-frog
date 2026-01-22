import { z } from 'zod'
import { MAX_BACKGROUND_OPACITY, MAX_FONT_SCALE, MAX_FONT_WEIGHT, MIN_BACKGROUND_OPACITY, MIN_FONT_SCALE, MIN_FONT_WEIGHT } from '@/utils/constants/subtitles'
import { batchQueueConfigSchema, requestQueueConfigSchema } from './translate'

export const subtitlesDisplayModeSchema = z.enum(['bilingual', 'originalOnly', 'translationOnly'])
export const subtitlesTranslationPositionSchema = z.enum(['above', 'below'])
export const subtitlesFontFamilySchema = z.enum(['system', 'roboto', 'noto-sans', 'noto-serif'])

export const subtitleTextStyleSchema = z.object({
  fontFamily: subtitlesFontFamilySchema,
  fontScale: z.number().min(MIN_FONT_SCALE).max(MAX_FONT_SCALE),
  color: z.string(),
  fontWeight: z.number().min(MIN_FONT_WEIGHT).max(MAX_FONT_WEIGHT),
})

export const subtitleContainerStyleSchema = z.object({
  backgroundOpacity: z.number().min(MIN_BACKGROUND_OPACITY).max(MAX_BACKGROUND_OPACITY),
})

export const subtitlesStyleSchema = z.object({
  displayMode: subtitlesDisplayModeSchema,
  translationPosition: subtitlesTranslationPositionSchema,
  main: subtitleTextStyleSchema,
  translation: subtitleTextStyleSchema,
  container: subtitleContainerStyleSchema,
})

export const videoSubtitlesSchema = z.object({
  enabled: z.boolean(),
  autoStart: z.boolean(),
  style: subtitlesStyleSchema,
  aiSegmentation: z.boolean(),
  requestQueueConfig: requestQueueConfigSchema,
  batchQueueConfig: batchQueueConfigSchema,
})

export type SubtitlesDisplayMode = z.infer<typeof subtitlesDisplayModeSchema>
export type SubtitlesTranslationPosition = z.infer<typeof subtitlesTranslationPositionSchema>
export type SubtitlesFontFamily = z.infer<typeof subtitlesFontFamilySchema>
export type SubtitleTextStyle = z.infer<typeof subtitleTextStyleSchema>
export type SubtitleContainerStyle = z.infer<typeof subtitleContainerStyleSchema>
export type SubtitlesStyle = z.infer<typeof subtitlesStyleSchema>
export type VideoSubtitles = z.infer<typeof videoSubtitlesSchema>
