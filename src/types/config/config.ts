import { langCodeISO6393Schema, langLevel } from "@read-frog/definitions"

import { z } from "zod"
import { FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { MIN_SIDE_CONTENT_WIDTH } from "@/utils/constants/side"
import { languageDetectionConfigSchema } from "./language-detection"
import { isLLMProvider, NON_API_TRANSLATE_PROVIDERS_MAP, providersConfigSchema } from "./provider"
import { selectionToolbarCustomActionsSchema } from "./selection-toolbar"
import { videoSubtitlesSchema } from "./subtitles"
import { translateConfigSchema } from "./translate"
import { ttsConfigSchema } from "./tts"
// Language schema
const languageSchema = z.object({
  sourceCode: langCodeISO6393Schema.or(z.literal("auto")),
  targetCode: langCodeISO6393Schema,
  level: langLevel,
})

// Floating button schema
const floatingButtonSchema = z.object({
  enabled: z.boolean(),
  position: z.number().min(0).max(1),
  disabledFloatingButtonPatterns: z.array(z.string()),
  clickAction: z.enum(["panel", "translate"]),
})

const selectionToolbarFeatureSchema = z.object({
  enabled: z.boolean(),
  providerId: z.string().nonempty(),
})

const selectionToolbarSpeakFeatureSchema = z.object({
  enabled: z.boolean(),
})

// Text selection toolbar schema
const selectionToolbarSchema = z.object({
  enabled: z.boolean(),
  disabledSelectionToolbarPatterns: z.array(z.string()),
  features: z.object({
    translate: selectionToolbarFeatureSchema,
    speak: selectionToolbarSpeakFeatureSchema,
    vocabularyInsight: selectionToolbarFeatureSchema,
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
  const providerIdsSet = new Set(data.providersConfig.map(p => p.id))

  for (const def of Object.values(FEATURE_PROVIDER_DEFS)) {
    const providerId = def.getProviderId(data)

    const validIds = new Set(providerIdsSet)
    for (const [type, name] of Object.entries(NON_API_TRANSLATE_PROVIDERS_MAP)) {
      if (def.isProvider(type))
        validIds.add(name)
    }

    if (!validIds.has(providerId)) {
      ctx.addIssue({
        code: "invalid_value",
        values: Array.from(validIds),
        message: `Invalid provider id "${providerId}".`,
        path: [...def.configPath],
      })
      continue
    }

    const provider = data.providersConfig.find(p => p.id === providerId)
    if (provider && !def.isProvider(provider.provider)) {
      ctx.addIssue({
        code: "invalid_value",
        values: Array.from(validIds),
        message: `Provider "${providerId}" is not a valid provider for this feature.`,
        path: [...def.configPath],
      })
    }

    if (provider && !provider.enabled) {
      ctx.addIssue({
        code: "custom",
        message: `Provider "${providerId}" must be enabled for this feature.`,
        path: [...def.configPath],
      })
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
    if (!providerIdsSet.has(providerId)) {
      ctx.addIssue({
        code: "invalid_value",
        values: Array.from(providerIdsSet),
        message: `Invalid provider id "${providerId}".`,
        path: ["selectionToolbar", "customActions", index, "providerId"],
      })
      return
    }

    const provider = data.providersConfig.find(p => p.id === providerId)
    if (provider && !isLLMProvider(provider.provider)) {
      ctx.addIssue({
        code: "custom",
        message: `Provider "${providerId}" is not an LLM provider.`,
        path: ["selectionToolbar", "customActions", index, "providerId"],
      })
      return
    }

    if (provider && !provider.enabled) {
      ctx.addIssue({
        code: "custom",
        message: `Provider "${providerId}" must be enabled for this custom action.`,
        path: ["selectionToolbar", "customActions", index, "providerId"],
      })
    }
  })
})

export type Config = z.infer<typeof configSchema>
