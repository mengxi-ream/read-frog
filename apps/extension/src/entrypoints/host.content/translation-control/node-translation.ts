import type { Point } from '@/types/dom'
import { getConfigFromStorage } from '@/utils/config/config'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { isEditable } from '@/utils/host/dom/filter'
import { removeOrShowNodeTranslation } from '@/utils/host/translate/node-manipulation'
import { logger } from '@/utils/logger'

export function registerNodeTranslationTriggers() {
  const mousePosition: Point = { x: 0, y: 0 }
  const keyState = {
    isHotkeyPressed: false,
    isOtherKeyPressed: false,
  }

  const getHotkey = async () => {
    const config = await getConfigFromStorage() ?? DEFAULT_CONFIG
    return config.translate.node.hotkey
  }
  const isEnabled = async () => {
    const config = await getConfigFromStorage() ?? DEFAULT_CONFIG
    return config.translate.node.enabled
  }

  let timerId: NodeJS.Timeout | null = null
  let actionTriggered = false

  // Listen the hotkey means the user can't press or hold any other key during the hotkey is holding
  document.addEventListener('keydown', async (e) => {
    if (!await isEnabled())
      return
    if (e.target instanceof HTMLElement && isEditable(e.target))
      return

    const hotkey = await getHotkey()
    if (e.key === hotkey) {
      if (!keyState.isHotkeyPressed) {
        keyState.isHotkeyPressed = true
        // If user hold other key, it will trigger keyState.isOtherKeyPressed = true; later by repeat event
        keyState.isOtherKeyPressed = false
        timerId = setTimeout(async () => {
          if (!keyState.isOtherKeyPressed && keyState.isHotkeyPressed) {
            const config = await getConfigFromStorage()
            if (!config) {
              logger.error('Global config is not initialized')
              return
            }
            void removeOrShowNodeTranslation(mousePosition, config)
            actionTriggered = true
          }
          timerId = null
        }, 500)
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

  document.addEventListener('keyup', async (e) => {
    if (!await isEnabled())
      return
    if (e.target instanceof HTMLElement && isEditable(e.target))
      return
    const hotkey = await getHotkey()
    if (e.key === hotkey) {
      // translate if user release the hotkey and no other key is pressed
      if (!keyState.isOtherKeyPressed) {
        if (timerId) {
          clearTimeout(timerId)
          timerId = null
        }
        if (!actionTriggered) {
          const config = await getConfigFromStorage()
          if (!config) {
            logger.error('Global config is not initialized')
            return
          }
          void removeOrShowNodeTranslation(mousePosition, config)
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
