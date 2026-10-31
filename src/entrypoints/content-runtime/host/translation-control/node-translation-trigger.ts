import type { HotkeyChord } from "@tanstack/hotkeys"
import type { NodeTranslationPreview } from "./node-translation-preview"
import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { matchesKeyboardEvent } from "@tanstack/hotkeys"
import { HOTKEY_EVENT_KEYS, isSingleKeyHotkey } from "@/utils/constants/hotkeys"
import { SELECTION_SHORTCUT_CLAIMED_EVENT } from "@/utils/constants/selection"
import { findNearestAncestorBlockNodeAt } from "@/utils/host/dom/find"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

const NODE_TRANSLATION_HOLD_TRIGGER_MS = 500
const CLICK_AND_HOLD_MOVE_TOLERANCE = 6
const MOUSEMOVE_THROTTLE_MS = 300
const MOUSEMOVE_DISTANCE_THRESHOLD = 3
// Letting go of any of these ends a custom combination's press.
const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"])

export interface NodeTranslationTriggerOptions {
  getConfig: () => Promise<Config | null>
  /** Translates a block: the one under the pointer, or the one a held hotkey's ring framed. */
  onTrigger: (block: Element, config: Config) => void | Promise<void>
  /** Shows what a held hotkey will translate when it is released. */
  preview?: Pick<NodeTranslationPreview, "show" | "hide">
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
  return matchesKeyboardEvent(event, shortcut as HotkeyChord)
}

/**
 * Registers the shared node-translation interaction state machine.
 *
 * The full host content script uses this to translate immediately while keeping
 * the hotkey and click-and-hold handling in one place.
 *
 * A hotkey, a single key or the combination recorded for `custom`, runs when it
 * is released after being pressed alone. Held past the hold delay, it first
 * rings the block under the pointer and follows the pointer, so the release
 * translates what the ring shows. Another key, a click or a lost focus in
 * between cancels it. The custom combination is kept from the page, as Read
 * Frog's other shortcuts are.
 */
export function registerNodeTranslationTriggerListeners({
  getConfig,
  onTrigger,
  preview,
  shouldIgnoreEvent = () => false,
}: NodeTranslationTriggerOptions): () => void {
  const ac = new AbortController()
  const { signal } = ac

  const mousePosition: Point = { x: 0, y: 0 }
  let hasMousePosition = false

  // The config a held hotkey's ring was drawn with; null while no ring shows.
  let previewConfig: Config | null = null

  const updateMousePosition = (point: Point) => {
    mousePosition.x = point.x
    mousePosition.y = point.y
    hasMousePosition = true
    if (previewConfig) preview?.show({ ...mousePosition }, previewConfig)
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
  // Whether the button is down right now. The press state below waits for a config read,
  // which a quick click can outlast.
  let isPrimaryButtonDown = false
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

  const translateBlockAt = (point: Point, config: Config) => {
    const block = findNearestAncestorBlockNodeAt(point, config)
    if (block) void onTrigger(block, config)
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

      // Throttled position update, except while a ring follows the pointer
      if (moveThrottleTimer && !previewConfig) return

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
  // The pressed hotkey: a single key, or a custom combination's main key. That one
  // goes by code, since Option turns the Q of Alt+Q into "œ" on macOS.
  let activeHotkeyEventKey: string | null = null
  let activeShortcutCode: string | null = null

  // Whether `config` still has the hotkey that started the press.
  const isActiveHotkey = (config: Config): boolean =>
    activeShortcutCode
      ? config.pageTranslation.node.enabled && config.pageTranslation.node.hotkey === "custom"
      : getHotkeyEventKey(config) === activeHotkeyEventKey

  // Whether letting go of this key ends the press: its own key, or any key of the combination.
  const isHotkeyRelease = (event: KeyboardEvent): boolean =>
    activeShortcutCode
      ? event.code === activeShortcutCode || MODIFIER_KEYS.has(event.key)
      : event.key === activeHotkeyEventKey

  const clearHoldTimer = () => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  /** Hides the ring, and returns the block it framed. */
  const hidePreview = (): Element | null => {
    if (!previewConfig) return null
    previewConfig = null
    return preview?.hide() ?? null
  }

  const resetHotkeySession = () => {
    clearHoldTimer()
    hidePreview()
    isHotkeyPressed = false
    isHotkeySessionPure = true
    activeHotkeyEventKey = null
    activeShortcutCode = null
  }

  // Another key or a click made the press part of something else: it translates nothing.
  // A key held before the hotkey does too, until it is released.
  const cancelHotkeySession = () => {
    isHotkeySessionPure = false
    clearHoldTimer()
    hidePreview()
  }

  // The hotkey is down: its release translates, and held for the hold delay it rings the block first.
  const startHotkeySession = () => {
    isHotkeyPressed = true
    if (!isHotkeySessionPure) return

    timerId = setTimeout(() => {
      timerId = null
      void (async () => {
        if (shouldIgnoreEvent()) return
        if (!isHotkeySessionPure || !isHotkeyPressed) return

        const currentConfig = await getCurrentConfig()
        if (!currentConfig || !isActiveHotkey(currentConfig)) return
        // Released or cancelled while the config was read
        if (!isHotkeySessionPure || !isHotkeyPressed) return

        previewConfig = currentConfig
        preview?.show(resolveTriggerPoint(), currentConfig)
      })()
    }, NODE_TRANSLATION_HOLD_TRIGGER_MS)
  }

  document.addEventListener(
    "mousedown",
    (event) => {
      void (async () => {
        if (shouldIgnoreEvent()) return
        // Ctrl+click opens a link and Shift+click extends a selection.
        if (isHotkeyPressed) cancelHotkeySession()
        if (event.button !== 0) return
        isPrimaryButtonDown = true
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
        if (!isPrimaryButtonDown) return

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
            // Let go of or moved while the config was read
            if (!isMousePressed || !mousePressPosition) return

            translateBlockAt(mousePressPosition, currentConfig)
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
      isPrimaryButtonDown = false
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
          if (!matchesCustomShortcut(event, config)) {
            // Another key while the combination is down. Its own modifiers come before it.
            if (isHotkeyPressed) cancelHotkeySession()
            return
          }
          // A held combination repeats its keydown.
          if (event.repeat || isHotkeyPressed) return

          activeShortcutCode = event.code
          isHotkeySessionPure = true
          startHotkeySession()
          return
        }

        const hotkeyEventKey = getHotkeyEventKey(config)
        if (!hotkeyEventKey) {
          resetHotkeySession()
          return
        }

        // A combination, with this key pressed first or last
        if (event.key !== hotkeyEventKey) {
          cancelHotkeySession()
          return
        }

        // Its own repeats while held
        if (isHotkeyPressed) return

        activeHotkeyEventKey = hotkeyEventKey
        startHotkeySession()
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
      cancelHotkeySession()
    },
    { signal },
  )

  // Keys released in another window never reach this page.
  window.addEventListener("blur", resetHotkeySession, { signal })

  document.addEventListener(
    "keyup",
    (event) => {
      void (async () => {
        if (shouldIgnoreEvent()) return

        const config = await getCurrentConfig()
        if (!isHotkeyPressed) {
          // A key pressed before the hotkey is let go: the next press starts clean.
          isHotkeySessionPure = true
          return
        }
        if (!isHotkeyRelease(event)) return

        const shouldTranslate =
          isHotkeySessionPure &&
          !isTypingInField(event) &&
          config !== null &&
          isActiveHotkey(config)
        const framedBlock = hidePreview()
        const point = resolveTriggerPoint()
        resetHotkeySession()
        if (!shouldTranslate || !config) return

        // A held key translates what its ring shows, which can trail the pointer for a moment.
        if (framedBlock?.isConnected) void onTrigger(framedBlock, config)
        else translateBlockAt(point, config)
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
