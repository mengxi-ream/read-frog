export const MAX_TEXT_LENGTH = 3000

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\uFEFF]/g
const WHITESPACE_RUN_RE = /\s+/g

/**
 * Clean and truncate article text for post processing
 */
export function cleanText(textContent: string, maxLength: number = MAX_TEXT_LENGTH): string {
  const cleaned = textContent
    .replace(ZERO_WIDTH_CHARS_RE, "") // 零宽字符
    .replace(WHITESPACE_RUN_RE, " ")
    .trim()

  return cleaned.length <= maxLength ? cleaned : cleaned.slice(0, maxLength)
}
