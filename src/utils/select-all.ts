// 选区工具栏和悬浮按钮各在一个 content script 里注册自己的 host，监听器互不相通。
// 所以每个监听器都只看 DOM：用这个属性找到所有 Read Frog 组件，用 :hover 判断鼠标在哪个组件上，
// 这样不管哪个监听器先跑，结果都一样。
const PROTECTED_HOST_ATTRIBUTE = "data-read-frog-select-all-protected"

export function protectSelectAllShadowRoot(shadowHost: HTMLElement, wrapper: HTMLElement) {
  shadowHost.setAttribute(PROTECTED_HOST_ATTRIBUTE, "")

  window.addEventListener(
    "keydown",
    (e) => {
      // 只处理 Ctrl+A (Windows/Linux) 或 Cmd+A (Mac)
      // metaKey 是 Mac 的 Command 键
      // ctrlKey 是 Windows 的 Ctrl 键
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !e.shiftKey) {
        // 组件已被移除（如扩展更新后）→ 这个监听器不再处理
        if (!shadowHost.isConnected) return

        const hosts = getProtectedHosts()
        const active = document.activeElement
        const focusedHost = hosts.find((host) => host === active)

        /* --- 分五种情况 --- */
        if (focusedHost) {
          // A. 焦点在某个组件的输入框里 → 放行默认行为
          // 焦点在组件的按钮上（如打开翻译卡片后）则和焦点在 body 一样处理
          if (isEditableElement(getDeepActiveElement(focusedHost))) return
        } else {
          if (isEditableElement(active)) {
            // B. 焦点在可编辑元素中（输入框、文本区域等）→ 放行默认行为
            return
          }

          // C. 当焦点在页面的其他 shadow root 内（active 是其他 shadow host）→ 放行默认行为
          if (active && (active as HTMLElement).shadowRoot) {
            return
          }
        }

        const hoveredHost = hosts.find((host) => host.matches(":hover"))
        if (hoveredHost) {
          // D. 鼠标悬停在某个组件里 → 自定义"组件专选"，由那个组件自己的监听器执行
          e.preventDefault()
          e.stopPropagation()
          if (hoveredHost === shadowHost) requestAnimationFrame(() => selectAllInside(wrapper))
          return
        }

        // E. 其它情况（宿主页面全选，但排除所有组件）
        // 没有任何交互时 → active = document.body
        // 只有当焦点在 body、无焦点或在组件里时，才执行"排除组件的全选"
        // 如果焦点在其他元素上（如 canvas 等），可能有应用自己的处理逻辑，不应干预
        // 点击了 canvas（如 Excalidraw） → <canvas> 元素
        if (active === document.body || !active || focusedHost) {
          e.preventDefault()
          e.stopPropagation()
          // 每个组件的监听器都会走到这里，重建出的选区相同，先后顺序不影响结果
          requestAnimationFrame(rebuildSelectionWithoutHosts)
        }
      }
    },
    true, // capture
  )
}

function getProtectedHosts() {
  return [...document.querySelectorAll<HTMLElement>(`[${PROTECTED_HOST_ATTRIBUTE}]`)]
}

/* 焦点在 shadow root 里时，document.activeElement 只是 host，要逐层往里找 */
function getDeepActiveElement(host: Element) {
  let active = host
  while (active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

/* 检查元素是否可编辑 */
function isEditableElement(element: Element | null): boolean {
  if (!element) return false

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
  if (!sel) return
  sel.removeAllRanges()

  const range = document.createRange()
  range.selectNodeContents(root) // 选中整个 wrapper ⭐
  sel.addRange(range) // 立即呈现高亮
}

// 选中整个页面，但跳过所有组件的 shadow host。
// 每个 host 把页面切成前后两段。Chrome 只保留第一个 range，Firefox 全部保留；
// 组件都挂在 <body> 末尾，所以第一段已经是组件之前的整个页面。
function rebuildSelectionWithoutHosts() {
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()

  const rest = document.createRange()
  rest.selectNodeContents(document.body)

  const ranges: Range[] = []
  for (const host of getProtectedHosts()) {
    if (!rest.intersectsNode(host)) continue
    const before = rest.cloneRange()
    before.setEndBefore(host)
    ranges.push(before)
    rest.setStartAfter(host)
  }
  ranges.push(rest)

  for (const range of ranges) {
    if (!range.collapsed) sel.addRange(range)
  }
}
