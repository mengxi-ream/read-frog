import { langCodeISO6393Schema, langLevel } from "@read-frog/definitions"

import { z } from "zod"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import {
  MAX_SELECTION_OVERLAY_OPACITY,
  MIN_SELECTION_OVERLAY_OPACITY,
} from "@/utils/constants/selection"
import { MIN_SIDE_CONTENT_WIDTH } from "@/utils/constants/side"
import {
  doesProviderSupportsCapability,
  getProviderIdsForCapability,
} from "@/utils/providers/provider-registry"
import { floatingButtonSchema } from "./floating-button"
import { languageDetectionConfigSchema } from "./language-detection"
import { isLLMProvider, providersConfigSchema } from "./provider"
import { selectionToolbarCustomActionsSchema } from "./selection-toolbar"
import { videoSubtitlesSchema } from "./subtitles"
import { pageTranslationShortcutSchema, translateConfigSchema } from "./translate"
import { ttsConfigSchema } from "./tts"
// Language schema
const languageSchema = z.object({
  sourceCode: langCodeISO6393Schema.or(z.literal("auto")),
  targetCode: langCodeISO6393Schema,
  level: langLevel,
})

const selectionToolbarFeatureSchema = z.object({
  enabled: z.boolean(),
  providerId: z.string().nonempty(),
  shortcut: pageTranslationShortcutSchema,
})

const selectionToolbarSpeakFeatureSchema = z.object({
  enabled: z.boolean(),
})

// Text selection toolbar schema
const selectionToolbarSchema = z.object({
  enabled: z.boolean(),
  disabledSelectionToolbarPatterns: z.array(z.string()),
  opacity: z.number()
    .min(MIN_SELECTION_OVERLAY_OPACITY)
    .max(MAX_SELECTION_OVERLAY_OPACITY),
  features: z.object({
    translate: selectionToolbarFeatureSchema,
    speak: selectionToolbarSpeakFeatureSchema,
  }),
  customActions: selectionToolbarCustomActionsSchema,
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
  z.literal("sourceCode"),
  z.literal("targetCode"),
  langCodeISO6393Schema,
])

// input translation schema (triple-space trigger)
const inputTranslationSchema = z.object({
  enabled: z.boolean(),
  providerId: z.string().nonempty(),
  fromLang: inputTranslationLangSchema,
  toLang: inputTranslationLangSchema,
  enableCycle: z.boolean(),
  timeThreshold: z.number().min(100).max(1000),
})

// Export types for use in components
export type InputTranslationLang = z.infer<typeof inputTranslationLangSchema>

// site control schema
const siteControlSchema = z.object({
  mode: z.enum(["blacklist", "whitelist"]),
  blacklistPatterns: z.array(z.string()),
  whitelistPatterns: z.array(z.string()),
})

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  providersConfig: providersConfigSchema,
  translate: translateConfigSchema,
  languageDetection: languageDetectionConfigSchema,
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
  for (const featureKey of FEATURE_KEYS) {
    const def = FEATURE_PROVIDER_DEFS[featureKey]
    const providerId = def.getProviderId(data)

    if (!doesProviderSupportsCapability(featureKey, data.providersConfig, providerId, { requireEnable: true })) {
      ctx.addIssue({
        code: "invalid_value",
        values: getProviderIdsForCapability(featureKey, data.providersConfig, { requireEnable: true }),
        message: `Invalid provider id "${providerId}".`,
        path: [...def.configPath],
      })
      continue
    }
  }

  // Validate languageDetection: when mode is "llm", providerId must be a valid enabled LLM provider
  if (data.languageDetection.mode === "llm") {
    const ldProviderId = data.languageDetection.providerId
    if (!ldProviderId) {
      ctx.addIssue({
        code: "custom",
        message: `Language detection mode is "llm" but no providerId is configured.`,
        path: ["languageDetection", "providerId"],
      })
    }
    else {
      const ldProvider = data.providersConfig.find(p => p.id === ldProviderId)
      if (!ldProvider) {
        ctx.addIssue({
          code: "custom",
          message: `Language detection provider "${ldProviderId}" not found in providersConfig.`,
          path: ["languageDetection", "providerId"],
        })
      }
      else {
        if (!isLLMProvider(ldProvider.provider)) {
          ctx.addIssue({
            code: "custom",
            message: `Language detection provider "${ldProviderId}" is not an LLM provider.`,
            path: ["languageDetection", "providerId"],
          })
        }
        if (!ldProvider.enabled) {
          ctx.addIssue({
            code: "custom",
            message: `Language detection provider "${ldProviderId}" must be enabled.`,
            path: ["languageDetection", "providerId"],
          })
        }
      }
    }
  }

  data.selectionToolbar.customActions.forEach((action, index) => {
    const providerId = action.providerId
    if (!doesProviderSupportsCapability("selectionToolbar.customAction", data.providersConfig, providerId, { requireEnable: true })) {
      ctx.addIssue({
        code: "invalid_value",
        values: getProviderIdsForCapability("selectionToolbar.customAction", data.providersConfig, { requireEnable: true }),
        message: `Invalid provider id "${providerId}".`,
        path: ["selectionToolbar", "customActions", index, "providerId"],
      })
    }
  })
})

export type Config = z.infer<typeof configSchema>
