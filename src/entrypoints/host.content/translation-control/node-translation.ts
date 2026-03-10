import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { getCachedConfig } from "@/utils/config/cached-config"
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
 * When config changes, the caller should teardown and re-register.
 * If node translation is disabled, returns a no-op teardown.
 */
export function registerNodeTranslationTriggers(config: Config): () => void {
  if (!config.translate.node.enabled) {
    return () => {}
  }

  const ac = new AbortController()
  const { signal } = ac
  const hotkey = config.translate.node.hotkey

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

  if (hotkey === "clickAndHold") {
    // --- Click-and-hold mode ---
    document.addEventListener("mousedown", (event) => {
      if (event.button !== 0)
        return
      if (event.target instanceof HTMLElement && isEditable(event.target))
        return

      isMousePressed = true
      clickAndHoldTriggered = false
      mousePressPosition = { x: event.clientX, y: event.clientY }

      clearClickAndHoldTimer()
      clickAndHoldTimerId = setTimeout(() => {
        if (!isMousePressed || !mousePressPosition || clickAndHoldTriggered)
          return
        const currentConfig = getCachedConfig()
        void removeOrShowNodeTranslation(mousePressPosition, currentConfig)
        clickAndHoldTriggered = true
      }, CLICK_AND_HOLD_TRIGGER_MS)
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
  }
  else {
    // --- Hotkey mode ---
    const hotkeyEventKey = HOTKEY_EVENT_KEYS[hotkey]
    let isHotkeyPressed = false
    let isHotkeySessionPure = true
    let timerId: ReturnType<typeof setTimeout> | null = null
    let actionTriggered = false

    document.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLElement && isEditable(e.target))
        return

      if (e.key === hotkeyEventKey) {
        if (!isHotkeyPressed) {
          isHotkeyPressed = true
          timerId = setTimeout(() => {
            if (isHotkeySessionPure && isHotkeyPressed) {
              const currentConfig = getCachedConfig()
              void removeOrShowNodeTranslation(mousePosition, currentConfig)
              actionTriggered = true
            }
            timerId = null
          }, 1000)
          // Cancel timer immediately if session is already impure
          if (!isHotkeySessionPure && timerId) {
            clearTimeout(timerId)
            timerId = null
          }
        }
      }
      else {
        // Any other key press marks the session as impure
        isHotkeySessionPure = false
        if (isHotkeyPressed && timerId) {
          clearTimeout(timerId)
          timerId = null
        }
      }
    }, { signal })

    document.addEventListener("keyup", (e) => {
      if (e.target instanceof HTMLElement && isEditable(e.target))
        return

      if (e.key === hotkeyEventKey) {
        if (isHotkeyPressed && isHotkeySessionPure) {
          if (timerId) {
            clearTimeout(timerId)
            timerId = null
          }
          if (!actionTriggered) {
            const currentConfig = getCachedConfig()
            void removeOrShowNodeTranslation(mousePosition, currentConfig)
          }
        }
        actionTriggered = false
        isHotkeyPressed = false
        isHotkeySessionPure = true
      }
    }, { signal })
  }

  // Teardown: abort all listeners + cancel pending timers
  return () => {
    ac.abort()
    if (moveThrottleTimer) {
      clearTimeout(moveThrottleTimer)
      moveThrottleTimer = null
    }
    clearClickAndHoldTimer()
  }
}
