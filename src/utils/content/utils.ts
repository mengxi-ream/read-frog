import { getLocalConfig } from "../config/storage"
import { DEFAULT_CONFIG } from "../constants/config"
import { isDontWalkIntoAndDontTranslateAsChildElement, isHTMLElement } from "../host/dom/filter"

export const MAX_TEXT_LENGTH = 3000

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\uFEFF]/g
const WHITESPACE_RUN_RE = /\s+/g

export async function removeDummyNodes(root: Document) {
  const elements = root.querySelectorAll("*")
  const config = await getLocalConfig() ?? DEFAULT_CONFIG
  elements.forEach((element) => {
    const isDontTranslate = isHTMLElement(element) && isDontWalkIntoAndDontTranslateAsChildElement(element, config)
    if (isDontTranslate) {
      element.remove()
    }
  })
}

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
