import type { ConflictCheckResult } from '../../types/highlight'
import { HIGHLIGHT_ATTRIBUTE } from './constants'

// 检查高亮冲突
export function checkHighlightConflicts(range: Range): ConflictCheckResult {
  // 检查选择范围内是否已包含高亮元素
  const container = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement || document

  const existingHighlights = container.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}="true"]`)

  for (const highlight of existingHighlights) {
    // 检查是否在选择范围内
    if (range.intersectsNode(highlight)) {
      return {
        hasConflict: true,
        reason: 'Selection range overlaps with existing highlight',
        conflictElement: highlight,
      }
    }
  }

  // 检查选择范围是否完全在某个高亮内部
  let currentNode: Node | null = range.startContainer
  while (currentNode && currentNode !== document.body) {
    if (currentNode instanceof Element && currentNode.hasAttribute(HIGHLIGHT_ATTRIBUTE)) {
      return {
        hasConflict: true,
        reason: 'Selection range is inside existing highlight',
        conflictElement: currentNode,
      }
    }
    currentNode = currentNode.parentNode
  }

  return { hasConflict: false }
}

// 生成唯一的高亮ID
export function generateHighlightId(): string {
  return `highlight_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// 截断文本用于显示
export function truncateText(text: string, maxLength: number = 50): string {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
}

// 检查元素是否为高亮元素
export function isHighlightElement(element: Element): boolean {
  return element.hasAttribute(HIGHLIGHT_ATTRIBUTE)
}

// 获取页面内所有高亮元素
export function getAllHighlightElements(): NodeListOf<Element> {
  return document.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}="true"]`)
}
