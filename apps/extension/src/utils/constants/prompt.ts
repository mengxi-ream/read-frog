import type { TranslatePrompt } from '@/types/config/provider'
import { APP_NAME } from './app'

export const DEFAULT_TRANSLATE_LINE_PROMPT = `Treat input as plain text input and translate it into {{targetLang}}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes.
Input:
{{input}}
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
