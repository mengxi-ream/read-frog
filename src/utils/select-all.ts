export function protectSelectAllShadowRoot(shadowHost: HTMLElement, wrapper: HTMLElement) {
  // ① 追踪鼠标是否在组件上
  let pointerInside = false
  shadowHost.addEventListener('pointerenter', () => {
    pointerInside = true
  })
  shadowHost.addEventListener('pointerleave', () => {
    pointerInside = false
  })

  window.addEventListener(
    'keydown',
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a')
        return

      const active = document.activeElement

      /* --- 分四种情况 --- */
      if (shadowHost.contains(active)) {
        // A. 焦点已经在组件里 → 放行默认行为
        return
      }

      if (isEditableElement(active)) {
        // B. 焦点在可编辑元素中（输入框、文本区域等）→ 放行默认行为
        return
      }

      if (pointerInside) {
        // C. 鼠标悬停在组件里 → 自定义"组件专选"
        e.preventDefault()
        e.stopPropagation()
        requestAnimationFrame(() => selectAllInside(wrapper))
        return
      }

      // D. 其它情况（宿主页面全选，但排除组件）
      e.preventDefault()
      e.stopPropagation()
      requestAnimationFrame(() => rebuildSelectionWithoutHost(shadowHost))
    },
    true, // capture
  )
}

/* 检查元素是否可编辑 */
function isEditableElement(element: Element | null): boolean {
  if (!element)
    return false

  const tagName = element.tagName.toLowerCase()

  // 检查 input 元素（排除非文本类型）
  if (tagName === 'input') {
    const inputType = (element as HTMLInputElement).type.toLowerCase()
    const textInputTypes = ['text', 'password', 'search', 'tel', 'url', 'email']
    return textInputTypes.includes(inputType)
  }

  // 检查 textarea
  if (tagName === 'textarea') {
    return true
  }

  // 检查 contenteditable
  const contentEditable = element.getAttribute('contenteditable')
  if (contentEditable === 'true' || contentEditable === '') {
    return true
  }

  return false
}

/* 全选组件内部（只需 1 个 Range） */
function selectAllInside(root: HTMLElement) {
  const sel = window.getSelection()
  if (!sel)
    return
  sel.removeAllRanges()

  const range = document.createRange()
  range.selectNodeContents(root) // 选中整个 wrapper ⭐
  sel.addRange(range) // 立即呈现高亮
}

function rebuildSelectionWithoutHost(shadowHost: HTMLElement) {
  const sel = window.getSelection()
  if (!sel)
    return
  sel.removeAllRanges()

  const before = document.createRange()
  before.setStart(document.body, 0)
  before.setEndBefore(shadowHost)

  const after = document.createRange()
  after.setStartAfter(shadowHost)
  after.setEnd(document.body, document.body.childNodes.length)

  sel.addRange(before)
  sel.addRange(after)
}
