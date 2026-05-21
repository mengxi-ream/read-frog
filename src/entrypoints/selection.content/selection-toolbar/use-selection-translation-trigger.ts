import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { matchDomainPattern } from "@/utils/url"

const EDITABLE_ELEMENT_SELECTOR = "input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']"

const MODIFIER_DELAY_MS = 100

function isEditableElement(element: Element | null): boolean {
  if (!element)
    return false
  return element.closest(EDITABLE_ELEMENT_SELECTOR) !== null
}

function isComposing(): boolean {
  return document.activeElement instanceof Element
    && document.activeElement.closest("[contenteditable]") !== null
    && window.getSelection()?.type === "Caret"
}

function getSelectionAnchorPosition(): { x: number, y: number } | undefined {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0)
    return undefined

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0)
    return undefined

  return {
    x: rect.left + rect.width / 2 + window.scrollX,
    y: rect.bottom + window.scrollY + 20,
  }
}

export function useSelectionTranslationTrigger(
  openPopover: (anchor?: { x: number, y: number }) => void,
) {
  const selectionTranslation = useAtomValue(configFieldsAtomMap.selectionTranslation)
  const triggerMode = selectionTranslation.triggerMode
  const lastTriggeredTextRef = useRef<string>("")
  const modifierDelayTimerRef = useRef<number | null>(null)
  const openPopoverRef = useRef(openPopover)
  openPopoverRef.current = openPopover

  const shouldShowToolbarOnMouseup = triggerMode === "toolbar" || triggerMode === "ctrl" || triggerMode === "alt" || triggerMode === "shift"

  const canTriggerTranslation = useCallback(() => {
    if (!selectionTranslation.enabled)
      return false
    if (selectionTranslation.disabledSites?.some(pattern =>
      matchDomainPattern(window.location.href, pattern),
    )) {
      return false
    }
    return true
  }, [selectionTranslation.enabled, selectionTranslation.disabledSites])

  const triggerTranslation = useCallback((anchor?: { x: number, y: number }) => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ""

    if (!text || !canTriggerTranslation())
      return

    if (text === lastTriggeredTextRef.current)
      return

    lastTriggeredTextRef.current = text
    const effectiveAnchor = anchor ?? getSelectionAnchorPosition()
    openPopoverRef.current(effectiveAnchor)
  }, [canTriggerTranslation])

  const clearModifierTimer = useCallback(() => {
    if (modifierDelayTimerRef.current !== null) {
      clearTimeout(modifierDelayTimerRef.current)
      modifierDelayTimerRef.current = null
    }
  }, [])

  const clearLastTriggeredText = useCallback(() => {
    lastTriggeredTextRef.current = ""
  }, [])

  useEffect(() => {
    if (triggerMode === "toolbar" || triggerMode === "direct")
      return

    const modifierKey = triggerMode === "ctrl" ? "Control" : triggerMode === "alt" ? "Alt" : triggerMode === "shift" ? "Shift" : null
    if (!modifierKey)
      return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat)
        return
      if (isEditableElement(document.activeElement))
        return
      if (isComposing())
        return
      if (e.key !== modifierKey)
        return

      // All modifier-triggered modes use a short delay to avoid
      // firing during common combos (Ctrl+C/V/A/F, Alt+Tab, etc.)
      clearModifierTimer()
      modifierDelayTimerRef.current = window.setTimeout(() => {
        modifierDelayTimerRef.current = null
        triggerTranslation()
      }, MODIFIER_DELAY_MS)
    }

    // Cancel the timer when any other key is pressed (combo key detected)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== modifierKey) {
        clearModifierTimer()
      }
    }

    // Cancel the timer on mouse/wheel events (Ctrl+Wheel zoom, Alt+Click, etc.)
    const handlePointerCancel = () => {
      clearModifierTimer()
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    document.addEventListener("wheel", handlePointerCancel, { passive: true })
    document.addEventListener("mousedown", handlePointerCancel)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
      document.removeEventListener("wheel", handlePointerCancel)
      document.removeEventListener("mousedown", handlePointerCancel)
      clearModifierTimer()
    }
  }, [triggerMode, triggerTranslation, clearModifierTimer])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.toString().trim().length === 0) {
        lastTriggeredTextRef.current = ""
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [])

  return {
    shouldShowToolbarOnMouseup,
    triggerTranslation,
    clearLastTriggeredText,
    triggerMode,
  }
}
