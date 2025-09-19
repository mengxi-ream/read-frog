import { getConfigFromStorage } from '@/utils/config/config'
import { DEFAULT_CONFIG } from '../constants/config'
import { DEFAULT_TRANSLATE_PROMPT, getTokenCellText, INPUT, TARGET_LANG } from '../constants/prompt'

export async function getTranslatePrompt(targetLang: string, input: string) {
  const config = await getConfigFromStorage() ?? DEFAULT_CONFIG
  const promptsConfig = config.translate.promptsConfig
  const { patterns = [], prompt: promptId = '' } = promptsConfig

  const prompt = patterns.find(pattern => pattern.id === promptId)?.prompt ?? DEFAULT_TRANSLATE_PROMPT

  return prompt
    .replaceAll(getTokenCellText(TARGET_LANG), targetLang)
    .replaceAll(getTokenCellText(INPUT), input)
}

export async function getBatchTranslatePrompt(targetLang: string, input: string) {
  const config = await getConfigFromStorage() ?? DEFAULT_CONFIG
  const promptsConfig = config.translate.promptsConfig
  const { patterns = [], prompt: promptId = '' } = promptsConfig

  const prompt = patterns.find(pattern => pattern.id === promptId)?.prompt ?? DEFAULT_TRANSLATE_PROMPT

  // 为批量翻译添加特殊指令
  const batchInstructions = `

**BATCH TRANSLATION RULES:**
- Translate each text segment separately
- Separate each translation with "%%" (double percent)
- Maintain the exact same order as input
- Do not add explanations or extra content

`

  return prompt
    .replaceAll(getTokenCellText(TARGET_LANG), targetLang)
    .replaceAll(getTokenCellText(INPUT), `${batchInstructions}${input}`)
}
