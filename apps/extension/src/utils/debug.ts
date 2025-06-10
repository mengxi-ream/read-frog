export function printNodeStructure(node: Node, indent = 0): string {
  const spacing = ' '.repeat(indent * 2)
  let result = ''

  if (node.nodeType === 3) {
    // 文本节点
    const text = node.textContent?.trim() || ''
    if (text) {
      result += `${spacing}"${text}"\n`
    }
  }
  else if (node.nodeType === 1) {
    // 元素节点
    const elem = node as HTMLElement
    const tagName = elem.tagName.toLowerCase()
    const attrs = Array.from(elem.attributes)
      .map(attr => `${attr.name}="${attr.value}"`)
      .join(' ')

    result += `${spacing}<${tagName}${attrs ? ` ${attrs}` : ''}>\n`

    // 递归处理子节点
    if (elem.childNodes.length > 0) {
      Array.from(elem.childNodes).forEach((child) => {
        result += printNodeStructure(child, indent + 1)
      })
    }

    result += `${spacing}</${tagName}>\n`
  }

  return result
}
