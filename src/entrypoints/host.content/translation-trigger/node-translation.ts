import type { Point } from '@/types/dom'
import { globalConfig } from '@/utils/config/config'
import { isEditable } from '@/utils/host/dom/filter'
import { hideOrShowNodeTranslation } from '@/utils/host/translate'

export function registerNodeTranslationTriggers() {
  const mousePosition: Point = { x: 0, y: 0 }
  const keyState = {
    isHotkeyPressed: false,
    isOtherKeyPressed: false,
  }

  const getHotkey = () => globalConfig?.translate.node.hotkey
  const isEnabled = () => globalConfig?.translate.node.enabled

  let timerId: NodeJS.Timeout | null = null // 延时触发的定时器
  let actionTriggered = false

  // Listen the hotkey means the user can't press or hold any other key during the hotkey is holding
  document.addEventListener('keydown', (e) => {
    if (!isEnabled())
      return
    if (e.target instanceof HTMLElement && isEditable(e.target))
      return

    if (e.key === getHotkey()) {
      if (!keyState.isHotkeyPressed) {
        keyState.isHotkeyPressed = true
        // If user hold other key, it will trigger keyState.isOtherKeyPressed = true; later by repeat event
        keyState.isOtherKeyPressed = false
        timerId = setTimeout(() => {
          if (!keyState.isOtherKeyPressed && keyState.isHotkeyPressed) {
            hideOrShowNodeTranslation(mousePosition)
            actionTriggered = true
          }
          timerId = null
        }, 500) // 延迟 500ms，可根据需要调整
      }
    }
    else if (keyState.isHotkeyPressed) {
      // don't translate if user press other key
      keyState.isOtherKeyPressed = true
      if (timerId) {
        clearTimeout(timerId)
        timerId = null
      }
    }
  })

  document.addEventListener('keyup', (e) => {
    if (!isEnabled())
      return
    if (e.target instanceof HTMLElement && isEditable(e.target))
      return
    if (e.key === getHotkey()) {
      // translate if user release the hotkey and no other key is pressed
      if (!keyState.isOtherKeyPressed) {
        if (timerId) {
          clearTimeout(timerId)
          timerId = null
        }
        if (!actionTriggered) {
          hideOrShowNodeTranslation(mousePosition)
        }
      }
      actionTriggered = false
      keyState.isHotkeyPressed = false
      keyState.isOtherKeyPressed = false
    }
  })

  document.body.addEventListener('mousemove', (event) => {
    mousePosition.x = event.clientX
    mousePosition.y = event.clientY
  })
}
