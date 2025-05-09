import { z } from "zod";
import { langCodeISO6393, langLevel } from "@/types/config/languages";
import { providerModels } from "@/types/config/provider";
import { HOTKEYS } from "@/utils/constants/config";

const hotkey = z.enum(HOTKEYS);

// Provider schema
const provider = z.enum(Object.keys(providerModels) as [string, ...string[]]);

// Provider config schema
const providerConfig = z.record(
  provider,
  z.object({
    apiKey: z.string().optional(),
    model: z.string(),
    isCustomModel: z.boolean(),
    customModel: z.string(),
  })
);

// Language schema
const languageSchema = z.object({
  detectedCode: langCodeISO6393,
  sourceCode: langCodeISO6393.or(z.literal("auto")),
  targetCode: langCodeISO6393,
  level: langLevel,
});

// Manual translate schema
const manualTranslateSchema = z.object({
  enabled: z.boolean(),
  hotkey,
});

// Floating button schema
const floatingButtonSchema = z.object({
  enabled: z.boolean(),
});

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  provider,
  providersConfig: providerConfig,
  manualTranslate: manualTranslateSchema,
  floatingButton: floatingButtonSchema,
});
