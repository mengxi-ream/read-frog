import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { HOTKEY_EVENT_KEYS } from "@/utils/constants/hotkeys"

const CLICK_AND_HOLD_TRIGGER_MS = 1000
const CLICK_AND_HOLD_MOVE_TOLERANCE = 6
const MOUSEMOVE_THROTTLE_MS = 300
const MOUSEMOVE_DISTANCE_THRESHOLD = 3

export interface NodeTranslationTriggerOptions {
  getConfig: () => Promise<Config | null>
  onTrigger: (point: Point, config: Config) => void | Promise<void>
  shouldIgnoreEvent?: () => boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false

  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA")
    return true
  if (target.isContentEditable)
    return true
  return false
}

/**
 * Registers the shared node-translation interaction state machine.
 *
 * The full host content script uses this to translate immediately while keeping
 * the hotkey and click-and-hold handling in one place.
 */
export function registerNodeTranslationTriggerListeners({
  getConfig,
  onTrigger,
  shouldIgnoreEvent = () => false,
}: NodeTranslationTriggerOptions): () => void {
  const ac = new AbortController()
  const { signal } = ac

  const mousePosition: Point = { x: 0, y: 0 }
  let hasMousePosition = false

  const updateMousePosition = (point: Point) => {
    mousePosition.x = point.x
    mousePosition.y = point.y
    hasMousePosition = true
  }

  const getDeepestHoveredElement = (): Element | null => {
    const hoveredElements = document.querySelectorAll(":hover")
    return hoveredElements.item(hoveredElements.length - 1)
  }

  const getElementCenterPoint = (element: Element): Point | null => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0)
      return null

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  const resolveTriggerPoint = (): Point => {
    if (hasMousePosition)
      return { ...mousePosition }

    const hoveredElement = getDeepestHoveredElement()
    const hoveredPoint = hoveredElement ? getElementCenterPoint(hoveredElement) : null
    return hoveredPoint ?? { ...mousePosition }
  }

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
    const config = await getConfig()
    if (signal.aborted)
      return null
    return config
  }

  const triggerNodeTranslation = (point: Point, config: Config) => {
    void onTrigger(point, config)
  }

  document.addEventListener("mousemove", (event) => {
    if (shouldIgnoreEvent())
      return

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

    updateMousePosition({ x: event.clientX, y: event.clientY })
    lastMoveX = event.clientX
    lastMoveY = event.clientY
  }, { signal })

  const updateMousePositionFromEvent = (event: MouseEvent | PointerEvent) => {
    if (shouldIgnoreEvent())
      return

    updateMousePosition({ x: event.clientX, y: event.clientY })
    lastMoveX = event.clientX
    lastMoveY = event.clientY
  }

  document.addEventListener("mouseover", updateMousePositionFromEvent, { signal })
  document.addEventListener("pointerover", updateMousePositionFromEvent, { signal })

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
      if (shouldIgnoreEvent())
        return
      if (event.button !== 0)
        return
      if (isEditableTarget(event.target))
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
          if (shouldIgnoreEvent())
            return
          if (!isMousePressed || !mousePressPosition || clickAndHoldTriggered)
            return

          const currentConfig = await getCurrentConfig()
          if (!currentConfig || !currentConfig.translate.node.enabled || currentConfig.translate.node.hotkey !== "clickAndHold")
            return

          triggerNodeTranslation(mousePressPosition, currentConfig)
          clickAndHoldTriggered = true
        })()
      }, CLICK_AND_HOLD_TRIGGER_MS)
    })()
  }, { signal })

  document.addEventListener("mouseup", (event) => {
    if (shouldIgnoreEvent())
      return
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
      if (shouldIgnoreEvent())
        return
      if (isEditableTarget(event.target))
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
              if (shouldIgnoreEvent())
                return
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

              triggerNodeTranslation(resolveTriggerPoint(), currentConfig)
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
      if (shouldIgnoreEvent())
        return
      if (isEditableTarget(event.target))
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

            triggerNodeTranslation(resolveTriggerPoint(), currentConfig)
          }
        }
        resetHotkeySession()
      }
    })()
  }, { signal })

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
