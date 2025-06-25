import { globalConfig } from '@/utils/config/config'
import { DEFAULT_TRANSLATE_LINE_PROMPT, INPUT_TOKEN, TARGET_LANG_TOKEN } from '../constants/prompt'

export function getTranslateLinePrompt(targetLang: string, input: string) {
  if (!globalConfig) {
    throw new Error('No global config when translate text')
  }
  const promptsConfig = globalConfig.translate.promptsConfig
  const { patterns = [], prompt: promptId = '' } = promptsConfig

  const prompt = patterns.find(pattern => pattern.id === promptId)?.prompt ?? DEFAULT_TRANSLATE_LINE_PROMPT

  return prompt
    .replaceAll(TARGET_LANG_TOKEN, targetLang)
    .replaceAll(INPUT_TOKEN, input)
}
