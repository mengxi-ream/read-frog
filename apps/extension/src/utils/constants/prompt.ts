import type { TranslatePromptObj } from '@/types/config/translate'

export const TOKENS = ['targetLang', 'input'] as const

/**
 * Separator used to distinguish multiple text segments in batch translation.
 * It is used to differentiate different text paragraphs when merging multiple translation tasks into a single request.
 */
export const BATCH_SEPARATOR = '%%'

export const TARGET_LANG = TOKENS[0]
export const INPUT = TOKENS[1]

export const getTokenCellText = (token: string) => `{{${token}}}`

export const DEFAULT_TRANSLATE_PROMPT = `You are a professional ${getTokenCellText(TARGET_LANG)} native translator who needs to fluently translate text into ${getTokenCellText(TARGET_LANG)}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

Translate to ${getTokenCellText(TARGET_LANG)}:
${getTokenCellText(INPUT)}
`

export const DEFAULT_BATCH_TRANSLATE_PROMPT = `## Multi-paragraph Translation Rules
1. If input contains ${BATCH_SEPARATOR}, use ${BATCH_SEPARATOR} in your output, if input has no ${BATCH_SEPARATOR}, don't use ${BATCH_SEPARATOR} in your output
2. **CRITICAL**: Preserve exact formatting around ${BATCH_SEPARATOR} - use exactly one newline before and after, with no extra spaces, tabs, or whitespace

## OUTPUT FORMAT:
- **Single paragraph input** → Output translation directly (no separators, no extra text)
- **Multi-paragraph input (input uses ${BATCH_SEPARATOR} separators)** → Use ${BATCH_SEPARATOR} as paragraph separator between translations

## Examples
### Multi-paragraph Input:
Paragraph A
${BATCH_SEPARATOR}
Paragraph B
${BATCH_SEPARATOR}
Paragraph C

### Multi-paragraph Output:
Translation A
${BATCH_SEPARATOR}
Translation B
${BATCH_SEPARATOR}
Translation C

### Single paragraph Input:
Single paragraph content

### Single paragraph Output:
Direct translation without separators
`

export const DEFAULT_TRANSLATE_PROMPT_ID = 'default'

export const DEFAULT_TRANSLATE_PROMPT_OBJ: TranslatePromptObj = {
  id: DEFAULT_TRANSLATE_PROMPT_ID,
  name: DEFAULT_TRANSLATE_PROMPT_ID,
  prompt: DEFAULT_TRANSLATE_PROMPT,
}

export const DEFAULT_TRANSLATE_PROMPTS_CONFIG = {
  prompt: DEFAULT_TRANSLATE_PROMPT_ID,
  patterns: [DEFAULT_TRANSLATE_PROMPT_OBJ],
}
