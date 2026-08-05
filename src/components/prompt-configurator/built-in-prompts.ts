import type { TranslatePromptObj } from "@/types/config/translate"
import {
  BUILT_IN_PAGE_TRANSLATE_PROMPTS,
  BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS,
  DEFAULT_TRANSLATE_PROMPT_ID,
  PRECISION_REWRITE_TRANSLATE_PROMPT_ID,
} from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"

interface BuiltInPromptDefinition {
  id: string
  systemPrompt: string
  prompt: string
}

export interface BuiltInPrompt extends TranslatePromptObj {
  description: string
}

function getBuiltInPromptCopy(id: string): Pick<BuiltInPrompt, "name" | "description"> {
  switch (id) {
    case DEFAULT_TRANSLATE_PROMPT_ID:
      return {
        name: i18n.t("options.translation.personalizedPrompts.default"),
        description: i18n.t(
          "options.translation.personalizedPrompts.builtInPrompts.default.description",
        ),
      }
    case PRECISION_REWRITE_TRANSLATE_PROMPT_ID:
      return {
        name: i18n.t(
          "options.translation.personalizedPrompts.builtInPrompts.precisionRewrite.name",
        ),
        description: i18n.t(
          "options.translation.personalizedPrompts.builtInPrompts.precisionRewrite.description",
        ),
      }
    default:
      throw new Error(`Unknown built-in prompt id: ${id}`)
  }
}

function localizeBuiltInPrompts(
  registry: Record<string, BuiltInPromptDefinition>,
): BuiltInPrompt[] {
  return Object.values(registry).map((prompt) => ({
    ...prompt,
    ...getBuiltInPromptCopy(prompt.id),
  }))
}

export function getBuiltInPageTranslatePrompts(): BuiltInPrompt[] {
  return localizeBuiltInPrompts(BUILT_IN_PAGE_TRANSLATE_PROMPTS)
}

export function getBuiltInSubtitleTranslatePrompts(): BuiltInPrompt[] {
  return localizeBuiltInPrompts(BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS)
}

export function getPageTranslatePromptSelectItems(patterns: TranslatePromptObj[]) {
  return [
    ...getBuiltInPageTranslatePrompts().map(({ id, name }) => ({ value: id, label: name })),
    ...patterns.map(({ id, name }) => ({ value: id, label: name })),
  ]
}
