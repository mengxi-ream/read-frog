import type { DeferredSelectionOpenDetail } from "./constants/selection"
import { DEFERRED_SELECTION_OPEN_EVENT, SELECTION_TOOLBAR_READY_EVENT } from "./constants/selection"

interface PendingSelection extends DeferredSelectionOpenDetail {
  anchorNode: Node | null
  anchorOffset: number
  focusNode: Node | null
  focusOffset: number
}

interface IframeSelectionTriggerOptions {
  requestRuntime: () => Promise<boolean>
  isRuntimeInjected: () => boolean
}

/** No config read, DOM scan or UI bootstrap until a real selection gesture. */
export function registerIframeSelectionTrigger({
  requestRuntime,
  isRuntimeInjected,
}: IframeSelectionTriggerOptions): () => void {
  let disposed = false
  let requesting = false
  let granted = false
  let pending: PendingSelection | null = null
  let timeout: ReturnType<typeof setTimeout> | undefined

  const clearPending = () => {
    pending = null
    granted = false
    clearTimeout(timeout)
    timeout = undefined
  }

  const cleanup = () => {
    disposed = true
    clearPending()
    document.removeEventListener("mouseup", handleGesture)
    document.removeEventListener("keyup", handleGesture)
    window.removeEventListener(SELECTION_TOOLBAR_READY_EVENT, replaySelection)
  }

  const replaySelection = () => {
    if (disposed || !granted || !window.__READ_FROG_SELECTION_TOOLBAR_READY__) return
    const selection = window.getSelection()
    // Never reopen a selection the user cleared or replaced during loading.
    if (
      pending &&
      selection?.toString() === pending.text &&
      selection.anchorNode === pending.anchorNode &&
      selection.anchorOffset === pending.anchorOffset &&
      selection.focusNode === pending.focusNode &&
      selection.focusOffset === pending.focusOffset
    ) {
      const { text, x, y } = pending
      window.dispatchEvent(
        new CustomEvent<DeferredSelectionOpenDetail>(DEFERRED_SELECTION_OPEN_EVENT, {
          detail: { text, x, y },
        }),
      )
    }
    // The full toolbar now owns subsequent gestures; release captured nodes.
    cleanup()
  }

  const handleGesture = (event: MouseEvent | KeyboardEvent) => {
    // Only a real user gesture should activate heavy runtime, not page-script events.
    if (!event.isTrusted || disposed || (isRuntimeInjected() && !pending)) return
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    )
      return
    const selection = window.getSelection()
    const text = selection?.toString()
    if (!selection || selection.isCollapsed || !selection.rangeCount || !text?.trim()) {
      pending = null
      return
    }
    let x: number
    let y: number
    if (event instanceof MouseEvent || event.type === "mouseup") {
      x = (event as MouseEvent).clientX
      y = (event as MouseEvent).clientY
    } else {
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      x = rect.right
      y = rect.bottom
    }
    pending = {
      text,
      x,
      y,
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
    }
    if (requesting || granted) return
    requesting = true
    // A failed injection must not retain a Range/node indefinitely.
    timeout = setTimeout(clearPending, 10000)
    void requestRuntime()
      .then((allowed) => {
        if (disposed) return
        if (!allowed) {
          clearPending()
          return
        }
        granted = true
        replaySelection()
      })
      .catch(clearPending)
      .finally(() => {
        requesting = false
      })
  }

  document.addEventListener("mouseup", handleGesture)
  document.addEventListener("keyup", handleGesture)
  window.addEventListener(SELECTION_TOOLBAR_READY_EVENT, replaySelection)
  return cleanup
}
