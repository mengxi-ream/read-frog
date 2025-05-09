import { HOTKEYS } from "@/utils/constants/config";
import { providersConfigSchema, providerSchema } from "./provider";
import { z } from "zod";
import { langCodeISO6393, langLevel } from "@/types/config/languages";

const hotkey = z.enum(HOTKEYS);
export type Hotkey = (typeof HOTKEYS)[number];

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
  hotkey: hotkey,
});

// Floating button schema
const floatingButtonSchema = z.object({
  enabled: z.boolean(),
});

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  provider: providerSchema,
  providersConfig: providersConfigSchema,
  manualTranslate: manualTranslateSchema,
  floatingButton: floatingButtonSchema,
});

export type Config = z.infer<typeof configSchema>;

// export type Config = {
//   language: {
//     detectedCode: LangCodeISO6393;
//     sourceCode: LangCodeISO6393 | "auto";
//     targetCode: LangCodeISO6393;
//     level: LangLevel;
//   };
//   provider: Provider;
//   providersConfig: ProviderConfig;
//   manualTranslate: {
//     enabled: boolean;
//     hotkey: Hotkey;
//   };
//   floatingButton: {
//     enabled: boolean;
//   };
// };
