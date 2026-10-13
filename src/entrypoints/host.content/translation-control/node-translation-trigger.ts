import type { Hotkey } from "@tanstack/hotkeys"
import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { matchesKeyboardEvent } from "@tanstack/hotkeys"
import { HOTKEY_EVENT_KEYS, isSingleKeyHotkey } from "@/utils/constants/hotkeys"
import { SELECTION_SHORTCUT_CLAIMED_EVENT } from "@/utils/constants/selection"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

const NODE_TRANSLATION_HOLD_TRIGGER_MS = 500
const CLICK_AND_HOLD_MOVE_TOLERANCE = 6
const MOUSEMOVE_THROTTLE_MS = 300
const MOUSEMOVE_DISTANCE_THRESHOLD = 3

export interface NodeTranslationTriggerOptions {
  getConfig: () => Promise<Config | null>
  onTrigger: (point: Point, config: Config) => void | Promise<void>
  shouldIgnoreEvent?: () => boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA") return true
  if (target.isContentEditable) return true
  return false
}

// Where a key was pressed. Inside a shadow root, `event.target` at the document
// is only the root's host, which hides a field typed in there.
function isTypingInField(event: KeyboardEvent): boolean {
  return isEditableTarget(event.composedPath()[0] ?? event.target)
}

function isDocumentSurfaceTarget(target: EventTarget | null): boolean {
  return (
    target === document ||
    target === window ||
    target === document.documentElement ||
    target === document.body
  )
}

/** The key a single-key hotkey listens for; null while the feature is off or uses another trigger. */
function getHotkeyEventKey(config: Config | null): string | null {
  if (!config?.pageTranslation.node.enabled) return null

  const { hotkey } = config.pageTranslation.node
  return isSingleKeyHotkey(hotkey) ? HOTKEY_EVENT_KEYS[hotkey] : null
}

/** Whether the event presses the recorded combination of the `custom` hotkey. */
function matchesCustomShortcut(event: KeyboardEvent, config: Config | null): boolean {
  if (!config?.pageTranslation.node.enabled) return false

  const { hotkey, shortcut } = config.pageTranslation.node
  if (hotkey !== "custom" || isShortcutEmpty(shortcut) || !isValidShortcut(shortcut)) return false
  return matchesKeyboardEvent(event, shortcut as Hotkey)
}

/**
 * Registers the shared node-translation interaction state machine.
 *
 * The full host content script uses this to translate immediately while keeping
 * the hotkey and click-and-hold handling in one place.
 *
 * A single-key hotkey runs when its key is tapped alone or held, a custom one
 * when its combination is pressed: on keydown, as Read Frog's other shortcuts
 * do, and kept from the page like them.
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
    if (rect.width <= 0 || rect.height <= 0) return null

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  const resolveTriggerPoint = (): Point => {
    if (hasMousePosition) return { ...mousePosition }

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

  const resetClickAndHoldState = () => {
    isMousePressed = false
    clickAndHoldTriggered = false
    mousePressPosition = null
  }

  const clearClickAndHoldTimer = () => {
    if (clickAndHoldTimerId) {
      clearTimeout(clickAndHoldTimerId)
      clickAndHoldTimerId = null
    }
  }

  // The last config read. Keeping the custom combination from the page has to
  // happen before keydown returns, too early to wait for a fresh read; every
  // keydown reads the config, so the modifiers pressed first refresh it.
  let latestConfig: Config | null = null

  const getCurrentConfig = async (): Promise<Config | null> => {
    const config = await getConfig()
    if (signal.aborted) return null
    latestConfig = config
    return config
  }

  const triggerNodeTranslation = (point: Point, config: Config) => {
    void onTrigger(point, config)
  }

  document.addEventListener(
    "mousemove",
    (event) => {
      if (shouldIgnoreEvent()) return

      // Distance threshold: ignore tiny movements (trackpad tremor, mouse jitter)
      if (
        Math.abs(event.clientX - lastMoveX) + Math.abs(event.clientY - lastMoveY) <=
        MOUSEMOVE_DISTANCE_THRESHOLD
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
      if (moveThrottleTimer) return

      moveThrottleTimer = setTimeout(() => {
        moveThrottleTimer = null
      }, MOUSEMOVE_THROTTLE_MS)

      updateMousePosition({ x: event.clientX, y: event.clientY })
      lastMoveX = event.clientX
      lastMoveY = event.clientY
    },
    { signal },
  )

  const updateMousePositionFromEvent = (event: MouseEvent | PointerEvent) => {
    if (shouldIgnoreEvent()) return

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

  document.addEventListener(
    "mousedown",
    (event) => {
      void (async () => {
        if (shouldIgnoreEvent()) return
        if (event.button !== 0) return
        if (isEditableTarget(event.target)) return
        if (isDocumentSurfaceTarget(event.target)) {
          resetClickAndHoldState()
          clearClickAndHoldTimer()
          return
        }

        const point = { x: event.clientX, y: event.clientY }

        const config = await getCurrentConfig()
        if (
          !config ||
          !config.pageTranslation.node.enabled ||
          config.pageTranslation.node.hotkey !== "clickAndHold"
        )
          return

        isMousePressed = true
        clickAndHoldTriggered = false
        mousePressPosition = point

        clearClickAndHoldTimer()
        clickAndHoldTimerId = setTimeout(() => {
          void (async () => {
            if (shouldIgnoreEvent()) return
            if (!isMousePressed || !mousePressPosition || clickAndHoldTriggered) return

            const currentConfig = await getCurrentConfig()
            if (
              !currentConfig ||
              !currentConfig.pageTranslation.node.enabled ||
              currentConfig.pageTranslation.node.hotkey !== "clickAndHold"
            )
              return

            triggerNodeTranslation(mousePressPosition, currentConfig)
            clickAndHoldTriggered = true
          })()
        }, NODE_TRANSLATION_HOLD_TRIGGER_MS)
      })()
    },
    { signal },
  )

  document.addEventListener(
    "mouseup",
    (event) => {
      if (shouldIgnoreEvent()) return
      if (event.button !== 0) return
      if (!isMousePressed && !clickAndHoldTimerId) return

      resetClickAndHoldState()
      clearClickAndHoldTimer()
    },
    { signal },
  )

  document.addEventListener(
    "keydown",
    (event) => {
      if (shouldIgnoreEvent()) return
      if (isTypingInField(event)) return

      if (matchesCustomShortcut(event, latestConfig)) {
        event.preventDefault()
        event.stopPropagation()
      }

      void (async () => {
        const config = await getCurrentConfig()
        if (config?.pageTranslation.node.hotkey === "custom") {
          resetHotkeySession()
          // A held combination repeats its keydown: it translates once.
          if (!event.repeat && matchesCustomShortcut(event, config)) {
            triggerNodeTranslation(resolveTriggerPoint(), config)
          }
          return
        }

        const hotkeyEventKey = getHotkeyEventKey(config)
        if (!hotkeyEventKey) {
          resetHotkeySession()
          return
        }

        if (event.key === hotkeyEventKey) {
          if (!isHotkeyPressed) {
            isHotkeyPressed = true
            activeHotkeyEventKey = hotkeyEventKey
            timerId = setTimeout(() => {
              void (async () => {
                if (shouldIgnoreEvent()) return
                if (!isHotkeySessionPure || !isHotkeyPressed) {
                  timerId = null
                  return
                }

                const currentConfig = await getCurrentConfig()
                const currentEventKey = getHotkeyEventKey(currentConfig)
                if (
                  !currentConfig ||
                  !currentEventKey ||
                  currentEventKey !== activeHotkeyEventKey
                ) {
                  timerId = null
                  return
                }

                triggerNodeTranslation(resolveTriggerPoint(), currentConfig)
                actionTriggered = true
                timerId = null
              })()
            }, NODE_TRANSLATION_HOLD_TRIGGER_MS)

            if (!isHotkeySessionPure && timerId) {
              clearTimeout(timerId)
              timerId = null
            }
          }
        } else {
          isHotkeySessionPure = false
          if (isHotkeyPressed && timerId) {
            clearTimeout(timerId)
            timerId = null
          }
        }
      })()
    },
    { signal },
  )

  // A selection shortcut took a key this listener never saw: the hotkey's
  // modifier was part of a combo, as when another key reaches keydown above.
  window.addEventListener(
    SELECTION_SHORTCUT_CLAIMED_EVENT,
    () => {
      if (shouldIgnoreEvent()) return
      isHotkeySessionPure = false
      if (isHotkeyPressed && timerId) {
        clearTimeout(timerId)
        timerId = null
      }
    },
    { signal },
  )

  document.addEventListener(
    "keyup",
    (event) => {
      void (async () => {
        if (shouldIgnoreEvent()) return
        if (isTypingInField(event)) return

        const config = await getCurrentConfig()
        const hotkeyEventKey = getHotkeyEventKey(config)
        if (!hotkeyEventKey) {
          if (event.key === activeHotkeyEventKey) resetHotkeySession()
          return
        }

        if (event.key === hotkeyEventKey || event.key === activeHotkeyEventKey) {
          if (isHotkeyPressed && isHotkeySessionPure) {
            if (timerId) {
              clearTimeout(timerId)
              timerId = null
            }
            if (!actionTriggered) {
              const currentConfig = await getCurrentConfig()
              if (!currentConfig || !getHotkeyEventKey(currentConfig)) return

              triggerNodeTranslation(resolveTriggerPoint(), currentConfig)
            }
          }
          resetHotkeySession()
        }
      })()
    },
    { signal },
  )

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
