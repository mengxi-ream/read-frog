import type { ArticleContent } from '@/types/content'
import { getLocalConfig } from '@/utils/config/storage'
import { DEFAULT_CONFIG } from '../constants/config'
import { DEFAULT_BATCH_TRANSLATE_PROMPT, DEFAULT_TRANSLATE_PROMPT, DEFAULT_TRANSLATE_SYSTEM_PROMPT, getTokenCellText, INPUT, SUMMARY, TARGET_LANG, TITLE } from '../constants/prompt'

export interface TranslatePromptOptions {
  isBatch?: boolean
  content?: ArticleContent
}

export interface TranslatePromptResult {
  systemPrompt: string
  prompt: string
}

export async function getTranslatePrompt(
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions,
): Promise<TranslatePromptResult> {
  const config = await getLocalConfig() ?? DEFAULT_CONFIG
  const customPromptsConfig = config.translate.customPromptsConfig
  const { patterns = [], promptId } = customPromptsConfig

  // Resolve system prompt and user prompt
  let systemPrompt: string
  let prompt: string

  if (!promptId) {
    // Use default prompts from constants
    systemPrompt = DEFAULT_TRANSLATE_SYSTEM_PROMPT
    prompt = DEFAULT_TRANSLATE_PROMPT
  }
  else {
    // Find custom prompt, fallback to default
    const customPrompt = patterns.find(pattern => pattern.id === promptId)
    systemPrompt = customPrompt?.systemPrompt ?? DEFAULT_TRANSLATE_SYSTEM_PROMPT
    prompt = customPrompt?.prompt ?? DEFAULT_TRANSLATE_PROMPT
  }

  // For batch mode, append batch rules to system prompt
  if (options?.isBatch) {
    systemPrompt = `${systemPrompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT}`
  }

  // Build title and summary replacement values
  const title = options?.content?.title || 'No title available'
  const summary = options?.content?.summary || 'No summary available'

  // Replace tokens in both prompts
  const replaceTokens = (text: string) =>
    text
      .replaceAll(getTokenCellText(TARGET_LANG), targetLang)
      .replaceAll(getTokenCellText(INPUT), input)
      .replaceAll(getTokenCellText(TITLE), title)
      .replaceAll(getTokenCellText(SUMMARY), summary)

  return {
    systemPrompt: replaceTokens(systemPrompt),
    prompt: replaceTokens(prompt),
  }
}
