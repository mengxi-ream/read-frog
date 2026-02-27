export function protectSelectAllShadowRoot(shadowHost: HTMLElement, wrapper: HTMLElement) {
  // ① 追踪鼠标是否在组件上
  let pointerInside = false
  shadowHost.addEventListener("pointerenter", () => {
    pointerInside = true
  })
  shadowHost.addEventListener("pointerleave", () => {
    pointerInside = false
  })

  window.addEventListener(
    "keydown",
    (e) => {
      // 只处理 Ctrl+A (Windows/Linux) 或 Cmd+A (Mac)
      // metaKey 是 Mac 的 Command 键
      // ctrlKey 是 Windows 的 Ctrl 键
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !e.shiftKey) {
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

        // C. 当焦点在其他 shadow root 内（active 是其他 shadow host）→ 放行默认行为
        if (active && (active as HTMLElement).shadowRoot) {
          return
        }

        if (pointerInside) {
          // D. 鼠标悬停在组件里 → 自定义"组件专选"
          e.preventDefault()
          e.stopPropagation()
          requestAnimationFrame(() => selectAllInside(wrapper))
          return
        }

        // E. 其它情况（宿主页面全选，但排除组件）
        // 没有任何交互时 → active = document.body
        // 只有当焦点在 body 或无焦点时，才执行"排除组件的全选"
        // 如果焦点在其他元素上（如 canvas 等），可能有应用自己的处理逻辑，不应干预
        // 点击了 canvas（如 Excalidraw） → <canvas> 元素
        if (active === document.body || !active) {
          e.preventDefault()
          e.stopPropagation()
          requestAnimationFrame(() => rebuildSelectionWithoutHost(shadowHost))
        }
      }
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
  if (tagName === "input") {
    const inputType = (element as HTMLInputElement).type.toLowerCase()
    const textInputTypes = ["text", "password", "search", "tel", "url", "email"]
    return textInputTypes.includes(inputType)
  }

  // 检查 textarea
  if (tagName === "textarea") {
    return true
  }

  // 检查 contenteditable
  const contentEditable = element.getAttribute("contenteditable")
  if (contentEditable === "true" || contentEditable === "") {
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

// 选中整个页面，但跳过你的 shadow host 组件。
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
