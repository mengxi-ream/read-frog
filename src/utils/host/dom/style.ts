/**
 * Smash the truncation style of the node if it has truncation style
 * @param element - The node to smash the truncation style
 */
export function smashTruncationStyle(element: HTMLElement) {
  if (element.style && element.style.webkitLineClamp) {
    element.style.webkitLineClamp = 'unset'
  }
  if (element.style && element.style.maxHeight) {
    element.style.maxHeight = 'unset'
  }

  // 处理更多可能导致文本截断的样式
  if (element.style && element.style.overflow) {
    element.style.overflow = 'visible'
  }
  if (element.style && element.style.textOverflow) {
    element.style.textOverflow = 'clip'
  }
  if (element.style && element.style.whiteSpace) {
    element.style.whiteSpace = 'normal'
  }

  // 检查计算样式并覆盖
  const computedStyle = window.getComputedStyle(element)

  // 创建一个包含所有需要检查的样式属性的数组
  const stylesToCheck = [
    'overflow',
    'textOverflow',
    'whiteSpace',
    'maxWidth',
    'maxHeight',
    'display',
    'fontStyle',
  ]

  // 检查 Medium 网站
  const isMediumSite = window.location.hostname.includes('medium.com')

  // 应用样式覆盖
  if (
    isMediumSite
    || stylesToCheck.some(prop =>
      computedStyle[prop as any] === 'hidden'
      || computedStyle[prop as any] === 'ellipsis'
      || (prop === 'fontStyle' && computedStyle[prop as any] === 'italic'),
    )
  ) {
    // 为了防止修改原始样式出现问题，我们添加一个覆盖类
    element.classList.add('read-frog-no-truncate')
  }

  if (element.style && element.style.position) {
    element.style.position = 'static'
  }
  if (element.style && element.style.float) {
    element.style.float = 'none'
  }
}
