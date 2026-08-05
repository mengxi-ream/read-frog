import { langCodeISO6393Schema } from "@read-frog/definitions"
import { z } from "zod"
import { HOTKEYS } from "@/utils/constants/hotkeys"
import {
  BUILT_IN_PAGE_TRANSLATE_PROMPT_IDS,
  DEFAULT_TRANSLATE_PROMPT_ID,
} from "@/utils/constants/prompt"
import {
  MAX_PRELOAD_MARGIN,
  MAX_PRELOAD_THRESHOLD,
  MIN_BATCH_CHARACTERS,
  MIN_BATCH_ITEMS,
  MIN_CHARACTERS_PER_NODE,
  MIN_PRELOAD_MARGIN,
  MIN_PRELOAD_THRESHOLD,
  MIN_TRANSLATE_CAPACITY,
  MIN_TRANSLATE_RATE,
  MIN_WORDS_PER_NODE,
} from "@/utils/constants/translate"
import { TRANSLATION_NODE_STYLE } from "@/utils/constants/translation-node-style"
import {
  isPageTranslationShortcutEmpty,
  isValidConfiguredPageTranslationShortcut,
} from "@/utils/page-translation-shortcut"

export const requestQueueConfigSchema = z.object({
  capacity: z.number().gte(MIN_TRANSLATE_CAPACITY),
  rate: z.number().gte(MIN_TRANSLATE_RATE),
})

export const batchQueueConfigSchema = z.object({
  maxCharactersPerBatch: z.number().gte(MIN_BATCH_CHARACTERS),
  maxItemsPerBatch: z.number().gte(MIN_BATCH_ITEMS),
})

export const TRANSLATION_MODES = ["bilingual", "translationOnly"] as const
export const translationModeSchema = z.enum(TRANSLATION_MODES)

export const pageTranslateRangeSchema = z.enum(["main", "all"])
export type PageTranslateRange = z.infer<typeof pageTranslateRangeSchema>

export const preloadConfigSchema = z.object({
  margin: z.number().min(MIN_PRELOAD_MARGIN).max(MAX_PRELOAD_MARGIN),
  threshold: z.number().min(MIN_PRELOAD_THRESHOLD).max(MAX_PRELOAD_THRESHOLD),
})
export type PreloadConfig = z.infer<typeof preloadConfigSchema>

// Translation node style preset (excluding 'custom' - controlled by isCustom flag)
export const translationNodeStylePresetSchema = z.enum(TRANSLATION_NODE_STYLE)
export type TranslationNodeStylePreset = z.infer<typeof translationNodeStylePresetSchema>

export const MAX_CUSTOM_CSS_LENGTH = 8192

// Translation node style configuration
export const translationNodeStyleConfigSchema = z.object({
  preset: translationNodeStylePresetSchema,
  isCustom: z.boolean(),
  customCSS: z.string().max(MAX_CUSTOM_CSS_LENGTH, "Custom CSS cannot exceed 8KB").nullable(),
})

export type TranslationNodeStyleConfig = z.infer<typeof translationNodeStyleConfigSchema>

export const translatePromptObjSchema = z.object({
  name: z.string(),
  id: z.string(),
  systemPrompt: z.string(),
  prompt: z.string(),
})
export type TranslatePromptObj = z.infer<typeof translatePromptObjSchema>

const storedPromptIdSchema = z.preprocess(
  (promptId) => (promptId === null ? DEFAULT_TRANSLATE_PROMPT_ID : promptId),
  z.string(),
)

function normalizeLegacyReservedPromptIds(value: unknown, builtInPromptIds: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value

  const promptConfig = value as Record<string, unknown>
  if (!Array.isArray(promptConfig.patterns)) return value

  const reservedIds = new Set(builtInPromptIds)
  const usedIds = new Set(builtInPromptIds)
  for (const pattern of promptConfig.patterns) {
    if (
      pattern &&
      typeof pattern === "object" &&
      !Array.isArray(pattern) &&
      typeof (pattern as Record<string, unknown>).id === "string" &&
      !reservedIds.has((pattern as Record<string, unknown>).id as string)
    ) {
      usedIds.add((pattern as Record<string, unknown>).id as string)
    }
  }

  let selectedCustomId: string | undefined
  let changed = false
  const patterns = promptConfig.patterns.map((pattern) => {
    if (!pattern || typeof pattern !== "object" || Array.isArray(pattern)) return pattern

    const id = (pattern as Record<string, unknown>).id
    if (typeof id !== "string" || !reservedIds.has(id)) return pattern

    const baseId = `${id}-custom`
    let renamedId = baseId
    let suffix = 2
    while (usedIds.has(renamedId)) {
      renamedId = `${baseId}-${suffix}`
      suffix += 1
    }
    usedIds.add(renamedId)
    changed = true

    // Before v092, a selected reserved-looking id could only identify the
    // custom prompt. Preserve the first match, exactly like the migration.
    if (selectedCustomId === undefined && promptConfig.promptId === id) {
      selectedCustomId = renamedId
    }

    return { ...pattern, id: renamedId }
  })

  if (!changed) return value
  return {
    ...promptConfig,
    promptId: selectedCustomId ?? promptConfig.promptId,
    patterns,
  }
}

export function createCustomPromptsConfigSchema(builtInPromptIds: readonly string[]) {
  const builtInPromptIdSet = new Set(builtInPromptIds)

  const normalizedPromptConfigSchema = z
    .object({
      // `null` was the persisted default through v091. Keep accepting it at
      // read boundaries so an options page opened before background migration
      // cannot replace the user's config with the full product defaults.
      promptId: storedPromptIdSchema,
      patterns: z.array(translatePromptObjSchema),
    })
    .superRefine((data, ctx) => {
      data.patterns.forEach((pattern, index) => {
        if (builtInPromptIdSet.has(pattern.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Custom prompt id "${pattern.id}" is reserved for a built-in prompt`,
            path: ["patterns", index, "id"],
          })
        }
      })

      const customPromptIds = data.patterns.map((pattern) => pattern.id)
      if (!builtInPromptIdSet.has(data.promptId) && !customPromptIds.includes(data.promptId)) {
        ctx.addIssue({
          code: "custom",
          message: `promptId "${data.promptId}" must match a built-in or custom prompt id`,
          path: ["promptId"],
        })
      }
    })

  return z.preprocess(
    (value) => normalizeLegacyReservedPromptIds(value, builtInPromptIds),
    normalizedPromptConfigSchema,
  )
}

export const pageCustomPromptsConfigSchema = createCustomPromptsConfigSchema(
  BUILT_IN_PAGE_TRANSLATE_PROMPT_IDS,
)

// Backwards-compatible export for the shared prompt configurator. Page
// translation is the only surface with more than one built-in prompt.
export const customPromptsConfigSchema = pageCustomPromptsConfigSchema

export const pageTranslationShortcutSchema = z.string().superRefine((shortcut, ctx) => {
  if (isPageTranslationShortcutEmpty(shortcut)) {
    return
  }

  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    ctx.addIssue({
      code: "custom",
      message:
        "Page translation shortcut must include at least one modifier key and one non-modifier key.",
    })
  }
})

export const translateConfigSchema = z.object({
  providerId: z.string().nonempty(),
  mode: translationModeSchema,
  modeShortcut: pageTranslationShortcutSchema,
  node: z.object({
    enabled: z.boolean(),
    hotkey: z.enum(HOTKEYS),
    // Keep the migration as the durable upgrade path, but also accept pre-v090
    // config in UI contexts that can load before the background migration runs.
    // Otherwise storageAdapter falls back to the full DEFAULT_CONFIG and a UI
    // write can persist that fallback over the user's settings.
    forceRetranslation: z.boolean().default(false),
  }),
  page: z.object({
    range: pageTranslateRangeSchema,
    autoTranslatePatterns: z.array(z.string()),
    neverAutoTranslatePatterns: z.array(z.string()),
    autoTranslateLanguages: z.array(langCodeISO6393Schema),
    shortcut: pageTranslationShortcutSchema,
    preload: preloadConfigSchema,
    minCharactersPerNode: z.number().min(MIN_CHARACTERS_PER_NODE),
    minWordsPerNode: z.number().min(MIN_WORDS_PER_NODE),
    enableTargetLanguageSkip: z.boolean(),
    skipLanguages: z.array(langCodeISO6393Schema),
  }),
  enableAIContentAware: z.boolean(),
  customPromptsConfig: customPromptsConfigSchema,
  requestQueueConfig: requestQueueConfigSchema,
  batchQueueConfig: batchQueueConfigSchema,
  translationNodeStyle: translationNodeStyleConfigSchema,
})

export type RequestQueueConfig = z.infer<typeof requestQueueConfigSchema>
export type BatchQueueConfig = z.infer<typeof batchQueueConfigSchema>

// How the source text sent to a translation provider should be interpreted:
// "plain" for plain text (the default), "html" for markup-bearing strings such
// as the outerHTML fragments produced by translationOnly page mode.
export type TranslationTextFormat = "plain" | "html"
export type TranslateConfig = z.infer<typeof translateConfigSchema>
export type TranslationMode = z.infer<typeof translationModeSchema>
