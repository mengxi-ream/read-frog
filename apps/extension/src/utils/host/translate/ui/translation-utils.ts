import type { TransNode } from '@/types/dom'
import { FORCE_INLINE_TRANSLATION_TAGS } from '../../../constants/dom-rules'
import { isHTMLElement } from '../../dom/filter'

// Helper function to check if content is purely numeric
export function isNumericContent(text: string): boolean {
  // Remove whitespace and check if remaining content is numeric
  // Allow numbers, decimals, commas, and common numeric separators
  const cleanedText = text.trim()
  if (!cleanedText)
    return false

  // Pattern matches numbers with optional thousand separators and decimal points
  // Examples: "123", "1,234", "1,234.56", "1 234", "1.234,56" (European format)
  const numericPattern = /^[\d\s,.-]+$/
  if (!numericPattern.test(cleanedText))
    return false

  // Additional check: ensure there's at least one digit
  return /\d/.test(cleanedText)
}

export function isForceInlineTranslation(targetNode: TransNode): boolean {
  if (isHTMLElement(targetNode)) {
    const computedStyle = window.getComputedStyle(targetNode)
    return FORCE_INLINE_TRANSLATION_TAGS.has(targetNode.tagName) || computedStyle.display.includes('flex')
  }
  return false
}
