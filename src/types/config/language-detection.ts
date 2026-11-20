import { z } from "zod"
import { optionalStoredProviderIdSchema } from "./provider-id"

export const languageDetectionModeSchema = z.enum(["basic", "llm"])
export type LanguageDetectionMode = z.infer<typeof languageDetectionModeSchema>

export const languageDetectionConfigSchema = z.object({
  mode: languageDetectionModeSchema,
  providerId: optionalStoredProviderIdSchema,
})
export type LanguageDetectionConfig = z.infer<typeof languageDetectionConfigSchema>
