import { z } from "zod"

// "llm" mode was removed in v87: per-paragraph LLM detection bypassed the
// translation rate limiter entirely. Local (franc) detection is the only mode.
export const languageDetectionModeSchema = z.enum(["basic"])
export type LanguageDetectionMode = z.infer<typeof languageDetectionModeSchema>

export const languageDetectionConfigSchema = z.object({
  mode: languageDetectionModeSchema,
})
export type LanguageDetectionConfig = z.infer<typeof languageDetectionConfigSchema>
