import { z } from "zod"

export const languageDetectionModeSchema = z.enum(["basic", "llm"])
export type LanguageDetectionMode = z.infer<typeof languageDetectionModeSchema>

export const languageDetectionConfigSchema = z.object({
  mode: languageDetectionModeSchema,
  providerId: z.string().optional(),
})
export type LanguageDetectionConfig = z.infer<typeof languageDetectionConfigSchema>
