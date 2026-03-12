import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { HOTKEY_EVENT_KEYS } from "@/utils/constants/hotkeys"
import { isEditable } from "@/utils/host/dom/filter"
import { removeOrShowNodeTranslation } from "@/utils/host/translate/node-manipulation"

const CLICK_AND_HOLD_TRIGGER_MS = 1000
const CLICK_AND_HOLD_MOVE_TOLERANCE = 6
const MOUSEMOVE_THROTTLE_MS = 300
const MOUSEMOVE_DISTANCE_THRESHOLD = 3

/**
 * Registers node translation triggers based on the current config.
 * Returns a teardown function to remove all listeners.
 *
 * Config is read on demand when the interaction fires so long-lived content
 * scripts don't drift if the page was frozen and missed storage events.
 */
export function registerNodeTranslationTriggers(): () => void {
  const ac = new AbortController()
  const { signal } = ac

  const mousePosition: Point = { x: 0, y: 0 }

  // --- Mousemove: throttled + distance threshold ---
  let lastMoveX = 0
  let lastMoveY = 0
  let moveThrottleTimer: ReturnType<typeof setTimeout> | null = null

  // --- Click-and-hold state ---
  let isMousePressed = false
  let clickAndHoldTriggered = false
  let mousePressPosition: Point | null = null
  let clickAndHoldTimerId: ReturnType<typeof setTimeout> | null = null

  const clearClickAndHoldTimer = () => {
    if (clickAndHoldTimerId) {
      clearTimeout(clickAndHoldTimerId)
      clickAndHoldTimerId = null
    }
  }

  const getCurrentConfig = async (): Promise<Config | null> => {
    const config = await getLocalConfig()
    if (signal.aborted)
      return null
    return config ?? DEFAULT_CONFIG
  }

  // Mousemove handler with throttle + distance threshold
  document.addEventListener("mousemove", (event) => {
    // Distance threshold: ignore tiny movements (trackpad tremor, mouse jitter)
    if (
      Math.abs(event.clientX - lastMoveX) + Math.abs(event.clientY - lastMoveY)
      <= MOUSEMOVE_DISTANCE_THRESHOLD
    ) {
      return
    }

    // Click-and-hold move cancellation (always immediate, no throttle)
    if (isMousePressed && mousePressPosition) {
      const deltaX = event.clientX - mousePressPosition.x
      const deltaY = event.clientY - mousePressPosition.y
      if (Math.hypot(deltaX, deltaY) > CLICK_AND_HOLD_MOVE_TOLERANCE) {
        isMousePressed = false
        mousePressPosition = null
        clearClickAndHoldTimer()
      }
    }

    // Throttled position update
    if (moveThrottleTimer)
      return

    moveThrottleTimer = setTimeout(() => {
      moveThrottleTimer = null
    }, MOUSEMOVE_THROTTLE_MS)

    mousePosition.x = event.clientX
    mousePosition.y = event.clientY
    lastMoveX = event.clientX
    lastMoveY = event.clientY
  }, { signal })

  let isHotkeyPressed = false
  let isHotkeySessionPure = true
  let timerId: ReturnType<typeof setTimeout> | null = null
  let actionTriggered = false
  let activeHotkeyEventKey: string | null = null

  const resetHotkeySession = () => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
    isHotkeyPressed = false
    isHotkeySessionPure = true
    actionTriggered = false
    activeHotkeyEventKey = null
  }

  document.addEventListener("mousedown", (event) => {
    void (async () => {
      if (event.button !== 0)
        return
      if (event.target instanceof HTMLElement && isEditable(event.target))
        return

      const config = await getCurrentConfig()
      if (!config || !config.translate.node.enabled || config.translate.node.hotkey !== "clickAndHold")
        return

      isMousePressed = true
      clickAndHoldTriggered = false
      mousePressPosition = { x: event.clientX, y: event.clientY }

      clearClickAndHoldTimer()
      clickAndHoldTimerId = setTimeout(() => {
        void (async () => {
          if (!isMousePressed || !mousePressPosition || clickAndHoldTriggered)
            return

          const currentConfig = await getCurrentConfig()
          if (!currentConfig || !currentConfig.translate.node.enabled || currentConfig.translate.node.hotkey !== "clickAndHold")
            return

          void removeOrShowNodeTranslation(mousePressPosition, currentConfig)
          clickAndHoldTriggered = true
        })()
      }, CLICK_AND_HOLD_TRIGGER_MS)
    })()
  }, { signal })

  document.addEventListener("mouseup", (event) => {
    if (event.button !== 0)
      return
    if (!isMousePressed && !clickAndHoldTimerId)
      return

    isMousePressed = false
    clickAndHoldTriggered = false
    mousePressPosition = null
    clearClickAndHoldTimer()
  }, { signal })

  document.addEventListener("keydown", (event) => {
    void (async () => {
      if (event.target instanceof HTMLElement && isEditable(event.target))
        return

      const config = await getCurrentConfig()
      if (!config || !config.translate.node.enabled || config.translate.node.hotkey === "clickAndHold") {
        resetHotkeySession()
        return
      }

      const hotkeyEventKey = HOTKEY_EVENT_KEYS[config.translate.node.hotkey]

      if (event.key === hotkeyEventKey) {
        if (!isHotkeyPressed) {
          isHotkeyPressed = true
          activeHotkeyEventKey = hotkeyEventKey
          timerId = setTimeout(() => {
            void (async () => {
              if (!isHotkeySessionPure || !isHotkeyPressed) {
                timerId = null
                return
              }

              const currentConfig = await getCurrentConfig()
              if (!currentConfig || !currentConfig.translate.node.enabled || currentConfig.translate.node.hotkey === "clickAndHold") {
                timerId = null
                return
              }
              if (HOTKEY_EVENT_KEYS[currentConfig.translate.node.hotkey] !== activeHotkeyEventKey) {
                timerId = null
                return
              }

              void removeOrShowNodeTranslation(mousePosition, currentConfig)
              actionTriggered = true
              timerId = null
            })()
          }, 1000)

          if (!isHotkeySessionPure && timerId) {
            clearTimeout(timerId)
            timerId = null
          }
        }
      }
      else {
        isHotkeySessionPure = false
        if (isHotkeyPressed && timerId) {
          clearTimeout(timerId)
          timerId = null
        }
      }
    })()
  }, { signal })

  document.addEventListener("keyup", (event) => {
    void (async () => {
      if (event.target instanceof HTMLElement && isEditable(event.target))
        return

      const config = await getCurrentConfig()
      if (!config || !config.translate.node.enabled || config.translate.node.hotkey === "clickAndHold") {
        if (event.key === activeHotkeyEventKey)
          resetHotkeySession()
        return
      }

      const hotkeyEventKey = HOTKEY_EVENT_KEYS[config.translate.node.hotkey]

      if (event.key === hotkeyEventKey || event.key === activeHotkeyEventKey) {
        if (isHotkeyPressed && isHotkeySessionPure) {
          if (timerId) {
            clearTimeout(timerId)
            timerId = null
          }
          if (!actionTriggered) {
            const currentConfig = await getCurrentConfig()
            if (!currentConfig || !currentConfig.translate.node.enabled || currentConfig.translate.node.hotkey === "clickAndHold")
              return

            void removeOrShowNodeTranslation(mousePosition, currentConfig)
          }
        }
        resetHotkeySession()
      }
    })()
  }, { signal })

  // Teardown: abort all listeners + cancel pending timers
  return () => {
    ac.abort()
    resetHotkeySession()
    if (moveThrottleTimer) {
      clearTimeout(moveThrottleTimer)
      moveThrottleTimer = null
    }
    clearClickAndHoldTimer()
  }
}
