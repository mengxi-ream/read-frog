import type { Config } from "@/types/config/config"
import {
  BUILT_IN_PAGE_TRANSLATE_PROMPTS,
  DEFAULT_TRANSLATE_PROMPT_ID,
} from "@/utils/constants/prompt"

type PagePrompts = Config["pageTranslation"]["customPromptsConfig"]

export function getHubPromptConfig(promptId: string, pagePrompts: PagePrompts): PagePrompts {
  const valid =
    Object.hasOwn(BUILT_IN_PAGE_TRANSLATE_PROMPTS, promptId) ||
    pagePrompts.patterns.some((pattern) => pattern.id === promptId)

  return {
    promptId: valid ? promptId : DEFAULT_TRANSLATE_PROMPT_ID,
    patterns: pagePrompts.patterns,
  }
}
