import { z } from "zod";
export const languageDetectionModeSchema = z.enum(["basic", "llm"]);
export const languageDetectionConfigSchema = z.object({
    mode: languageDetectionModeSchema,
    providerId: z.string().optional(),
});
