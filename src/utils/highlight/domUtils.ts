import { HIGHLIGHT_ATTRIBUTE, HIGHLIGHT_GROUP_ATTRIBUTE, HIGHLIGHT_ID_ATTRIBUTE } from './constants'

// 获取文本节点在父容器中的路径
export function getTextNodePath(textNode: Node, container: Element): number[] {
  const path: number[] = []
  let currentNode: Node | null = textNode

  while (currentNode && currentNode !== container) {
    const parent: Node | null = currentNode.parentNode
    if (parent) {
      const childNodes = Array.from(parent.childNodes)
      const index = childNodes.indexOf(currentNode as ChildNode)
      path.unshift(index)
      currentNode = parent
    }
    else {
      console.error('parent node not found, path calculation failed')
      break
    }
  }

  return path
}

// 根据路径获取文本节点
export function getTextNodeByPath(path: number[], container: Element): Node | null {
  let currentNode: Node = container

  for (let i = 0; i < path.length; i++) {
    const index = path[i]

    if (currentNode.childNodes[index]) {
      currentNode = currentNode.childNodes[index]
    }
    else {
      console.error(`path lookup failed: index ${index} out of range (${currentNode.childNodes.length} child nodes)`)
      return null
    }
  }

  return currentNode.nodeType === Node.TEXT_NODE ? currentNode : null
}

// 创建高亮元素的基础样式
export function createHighlightElement(color: string, id: string, isSegment: boolean = false, segmentIndex?: number): HTMLSpanElement {
  const span = document.createElement('span')
  span.style.backgroundColor = color
  span.style.borderRadius = '2px'
  span.style.padding = '0 1px'
  span.className = 'read-frog-highlight-mark'
  span.setAttribute(HIGHLIGHT_ATTRIBUTE, 'true')

  if (isSegment && segmentIndex !== undefined) {
    span.setAttribute(HIGHLIGHT_ID_ATTRIBUTE, `${id}_${segmentIndex}`)
    span.setAttribute(HIGHLIGHT_GROUP_ATTRIBUTE, id)
  }
  else {
    span.setAttribute(HIGHLIGHT_ID_ATTRIBUTE, id)
  }

  return span
}

// 移除高亮元素，恢复原始文本
export function removeHighlightElement(element: HTMLElement): void {
  const parent = element.parentNode
  if (parent) {
    parent.insertBefore(document.createTextNode(element.textContent || ''), element)
    parent.removeChild(element)
    // 合并相邻的文本节点
    parent.normalize()
  }
}
