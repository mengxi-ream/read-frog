import type { Point } from '@/types/dom'
import eruda from 'eruda'
import { globalConfig, loadGlobalConfigPromise } from '@/utils/config/config'
import { isEditable } from '@/utils/host/dom/filter'

import { hideOrShowNodeTranslation, translatePage } from '@/utils/host/translate'
import './style.css'

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    await loadGlobalConfigPromise
    eruda.init()
    registerTranslationTriggers()
  },
})

function registerTranslationTriggers() {
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

  // Four-finger touch gesture to trigger translatePage
  let touchStartTime = 0
  let fourFingerTouchStarted = false
  let initialTouchPositions: Array<{ x: number, y: number }> = []

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 4) {
      fourFingerTouchStarted = true
      touchStartTime = Date.now()
      // 记录初始触摸位置
      initialTouchPositions = Array.from(e.touches).map(touch => ({
        x: touch.clientX,
        y: touch.clientY,
      }))
    }
    else {
      fourFingerTouchStarted = false
      initialTouchPositions = []
    }
  }, { passive: true })

  document.addEventListener('touchend', (e) => {
    // Check if this was a four-finger tap (short duration touch)
    if (fourFingerTouchStarted && e.touches.length === 0) {
      const touchDuration = Date.now() - touchStartTime
      // Consider it a tap if touch duration is less than 500ms
      if (touchDuration < 500) {
        translatePage()
      }
      fourFingerTouchStarted = false
      initialTouchPositions = []
    }
  }, { passive: true })

  document.addEventListener('touchmove', (e) => {
    // Cancel four-finger gesture if fingers move too much or finger count changes
    if (!fourFingerTouchStarted)
      return

    // 检查手指数量是否改变
    if (e.touches.length !== 4) {
      fourFingerTouchStarted = false
      initialTouchPositions = []
      return
    }

    // 检查移动距离是否超过阈值（允许一定的移动容差）
    const MOVE_THRESHOLD = 30 // 30px 的移动阈值
    let hasMoveExceedThreshold = false

    for (let i = 0; i < Math.min(e.touches.length, initialTouchPositions.length); i++) {
      const currentTouch = e.touches[i]
      const initialPos = initialTouchPositions[i]
      const deltaX = Math.abs(currentTouch.clientX - initialPos.x)
      const deltaY = Math.abs(currentTouch.clientY - initialPos.y)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (distance > MOVE_THRESHOLD) {
        hasMoveExceedThreshold = true
        break
      }
    }

    if (hasMoveExceedThreshold) {
      fourFingerTouchStarted = false
      initialTouchPositions = []
    }
  }, { passive: true })
}
