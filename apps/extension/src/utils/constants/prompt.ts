import type { TranslatePrompt } from '@/types/config/provider'
import { APP_NAME } from './app'

export const TARGET_LANG_TOKEN = '{{targetLang}}'
export const INPUT_TOKEN = '{{input}}'

export const DEFAULT_TRANSLATE_LINE_PROMPT = `Treat input as plain text input and translate it into ${TARGET_LANG_TOKEN}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes.
Input:
${INPUT_TOKEN}
`

export const DEFAULT_TRANSLATE_PROMPT_ID = `${APP_NAME}: TRANSLATE_DEFAULT_PROMPT`

export const DEFAULT_TRANSLATE_PROMPT: TranslatePrompt = {
  id: DEFAULT_TRANSLATE_PROMPT_ID,
  name: DEFAULT_TRANSLATE_PROMPT_ID,
  prompt: DEFAULT_TRANSLATE_LINE_PROMPT,
}

export const DEFAULT_TRANSLATE_PROMPTS_CONFIG = {
  prompt: DEFAULT_TRANSLATE_PROMPT_ID,
  patterns: [DEFAULT_TRANSLATE_PROMPT],
}
