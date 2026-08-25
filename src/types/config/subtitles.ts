import { z } from "zod"
import { BUILT_IN_SUBTITLE_TRANSLATE_PROMPT_IDS } from "@/utils/constants/prompt"
import {
  MAX_BACKGROUND_OPACITY,
  MAX_FONT_SCALE,
  MAX_FONT_WEIGHT,
  MIN_BACKGROUND_OPACITY,
  MIN_FONT_SCALE,
  MIN_FONT_WEIGHT,
} from "@/utils/constants/subtitles"
import {
  batchQueueConfigSchema,
  createCustomPromptsConfigSchema,
  MAX_CUSTOM_CSS_LENGTH,
  pageTranslationShortcutSchema,
  requestQueueConfigSchema,
} from "./translate"

export const subtitleCustomPromptsConfigSchema = createCustomPromptsConfigSchema(
  BUILT_IN_SUBTITLE_TRANSLATE_PROMPT_IDS,
)

export const subtitlesDisplayModeSchema = z.enum(["bilingual", "originalOnly", "translationOnly"])
export const subtitlesTranslationPositionSchema = z.enum(["above", "below"])
export const subtitlesFontFamilySchema = z.enum(["system", "roboto", "noto-sans", "noto-serif"])

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
  /** Extra CSS for the subtitle lines, on top of the picked fonts and colours. `null` is off. */
  customCSS: z.string().max(MAX_CUSTOM_CSS_LENGTH, "Custom CSS cannot exceed 8KB").nullable(),
})

export const subtitlePositionSchema = z.object({
  percent: z.number().min(0).max(100),
  anchor: z.enum(["top", "bottom"]),
})

export const videoSubtitlesSchema = z.object({
  enabled: z.boolean(),
  autoStart: z.boolean(),
  toggleShortcut: pageTranslationShortcutSchema,
  providerId: z.string().nonempty(),
  style: subtitlesStyleSchema,
  aiSegmentation: z.boolean(),
  requestQueueConfig: requestQueueConfigSchema,
  batchQueueConfig: batchQueueConfigSchema,
  customPromptsConfig: subtitleCustomPromptsConfigSchema,
  position: subtitlePositionSchema,
})

export type SubtitlesDisplayMode = z.infer<typeof subtitlesDisplayModeSchema>
export type SubtitlesTranslationPosition = z.infer<typeof subtitlesTranslationPositionSchema>
export type SubtitlesFontFamily = z.infer<typeof subtitlesFontFamilySchema>
export type SubtitleTextStyle = z.infer<typeof subtitleTextStyleSchema>
export type SubtitleContainerStyle = z.infer<typeof subtitleContainerStyleSchema>
export type SubtitlesStyle = z.infer<typeof subtitlesStyleSchema>
export type SubtitlePosition = z.infer<typeof subtitlePositionSchema>
export type VideoSubtitles = z.infer<typeof videoSubtitlesSchema>
