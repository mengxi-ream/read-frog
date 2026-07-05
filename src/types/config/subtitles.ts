import { z } from "zod"
import { MAX_BACKGROUND_OPACITY, MAX_FONT_SCALE, MAX_FONT_WEIGHT, MIN_BACKGROUND_OPACITY, MIN_FONT_SCALE, MIN_FONT_WEIGHT } from "@/utils/constants/subtitles"
import { batchQueueConfigSchema, customPromptsConfigSchema, requestQueueConfigSchema } from "./translate"

export const subtitlesDisplayModeSchema = z.enum(["bilingual", "originalOnly", "translationOnly"])

// Which text the subtitle TTS should read aloud.
export const subtitleTtsReadTargetSchema = z.enum(["translation", "original"])
export type SubtitleTtsReadTarget = z.infer<typeof subtitleTtsReadTargetSchema>

// Voice selection strategy: "auto" picks a voice matching the read-target
// language from the shared TTS config; "custom" uses the explicitly chosen voice.
export const subtitleTtsVoiceModeSchema = z.enum(["auto", "custom"])
export type SubtitleTtsVoiceMode = z.infer<typeof subtitleTtsVoiceModeSchema>

export const subtitleTtsConfigSchema = z.object({
  enabled: z.boolean(),
  readTarget: subtitleTtsReadTargetSchema,
  voiceMode: subtitleTtsVoiceModeSchema,
  // Only meaningful when voiceMode === "custom"; empty string means "not set".
  customVoice: z.string(),
  // Signed percentage offset applied on top of the shared TTS rate.
  rate: z.number().int().min(-100).max(100),
  // Whether to stop TTS when the video is paused, and resume-friendly behavior.
  pauseWithVideo: z.boolean(),
})
export type SubtitleTtsConfig = z.infer<typeof subtitleTtsConfigSchema>

export const DEFAULT_SUBTITLE_TTS_CONFIG: SubtitleTtsConfig = {
  enabled: false,
  readTarget: "translation",
  voiceMode: "auto",
  customVoice: "",
  rate: 0,
  pauseWithVideo: true,
}
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
})

export const subtitlePositionSchema = z.object({
  percent: z.number().min(0).max(100),
  anchor: z.enum(["top", "bottom"]),
})

export const videoSubtitlesSchema = z.object({
  enabled: z.boolean(),
  autoStart: z.boolean(),
  providerId: z.string().nonempty(),
  style: subtitlesStyleSchema,
  aiSegmentation: z.boolean(),
  requestQueueConfig: requestQueueConfigSchema,
  batchQueueConfig: batchQueueConfigSchema,
  customPromptsConfig: customPromptsConfigSchema,
  position: subtitlePositionSchema,
  tts: subtitleTtsConfigSchema,
})

export type SubtitlesDisplayMode = z.infer<typeof subtitlesDisplayModeSchema>
export type SubtitlesTranslationPosition = z.infer<typeof subtitlesTranslationPositionSchema>
export type SubtitlesFontFamily = z.infer<typeof subtitlesFontFamilySchema>
export type SubtitleTextStyle = z.infer<typeof subtitleTextStyleSchema>
export type SubtitleContainerStyle = z.infer<typeof subtitleContainerStyleSchema>
export type SubtitlesStyle = z.infer<typeof subtitlesStyleSchema>
export type SubtitlePosition = z.infer<typeof subtitlePositionSchema>
export type VideoSubtitles = z.infer<typeof videoSubtitlesSchema>
