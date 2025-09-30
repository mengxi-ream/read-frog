import { getConfigFromStorage } from '@/utils/config/config'
import { DEFAULT_CONFIG } from '../constants/config'
import { DEFAULT_BATCH_TRANSLATE_PROMPT, DEFAULT_TRANSLATE_PROMPT, getTokenCellText, INPUT, TARGET_LANG } from '../constants/prompt'

export async function getTranslatePrompt(
  targetLang: string,
  input: string,
  options?: { isBatch?: boolean },
) {
  const config = await getConfigFromStorage() ?? DEFAULT_CONFIG
  const promptsConfig = config.translate.promptsConfig
  const { patterns = [], prompt: promptId = '' } = promptsConfig

  let prompt = patterns.find(pattern => pattern.id === promptId)?.prompt ?? DEFAULT_TRANSLATE_PROMPT

  if (options?.isBatch) {
    prompt = `
${prompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT}
`
  }

  return prompt
    .replaceAll(getTokenCellText(TARGET_LANG), targetLang)
    .replaceAll(getTokenCellText(INPUT), input)
}
