import type { FirefoxOutsideInteractionGuard } from './firefox-compat'
import * as React from 'react'
import {
  elementMatchesSelector,
  getComposedEventPath,
  getIsFirefoxExtensionEnv,
  registerFirefoxOutsideGuard,
  unregisterFirefoxOutsideGuard,
} from './firefox-compat'

interface Options {
  controlledOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  isEnabled?: boolean
  triggerSelectors: string[]
  interactiveSelectors?: string[]
  contentSelector: string
}

interface Result {
  isFirefoxMode: boolean
  rootOpen: boolean | undefined
  rootDefaultOpen: boolean | undefined
  handleOpenChange: (open: boolean) => void
  grantClosePermission: () => void
}

const ESCAPE_KEY = 'Escape'
const CLOSE_PERMISSION_MS = 400
const JUST_OPENED_DEBOUNCE_MS = 250

function toElement(target: EventTarget | null | undefined): Element | null {
  if (!target)
    return null
  return target instanceof Element ? target : null
}

function pathMatchesSelector(path: EventTarget[], selectors: string[]): boolean {
  if (selectors.length === 0)
    return false

  for (const entry of path) {
    if (!(entry instanceof Element))
      continue
    for (const selector of selectors) {
      if (elementMatchesSelector(entry, selector))
        return true
    }
  }

  return false
}

function matchesAnySelector(target: Element | null, selectors: string[], path: EventTarget[]): boolean {
  if (target) {
    for (const selector of selectors) {
      if (elementMatchesSelector(target, selector))
        return true
    }
  }

  return pathMatchesSelector(path, selectors)
}

export function useFirefoxRadixOpenController(options: Options): Result {
  const {
    controlledOpen,
    defaultOpen = false,
    onOpenChange,
    isEnabled = true,
    triggerSelectors,
    interactiveSelectors = [],
    contentSelector,
  } = options

  const isFirefoxExtensionEnv = React.useMemo(() => getIsFirefoxExtensionEnv(), [])
  const isFirefoxMode = isFirefoxExtensionEnv && isEnabled

  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const openRef = React.useRef(open ?? false)
  const justOpenedRef = React.useRef(false)
  const allowCloseRef = React.useRef(false)
  const debounceTimeoutRef = React.useRef<number | undefined>(undefined)
  const allowCloseTimeoutRef = React.useRef<number | undefined>(undefined)

  const clearDebounce = React.useCallback(() => {
    if (debounceTimeoutRef.current !== undefined) {
      window.clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = undefined
    }
  }, [])

  const clearAllowCloseTimeout = React.useCallback(() => {
    if (allowCloseTimeoutRef.current !== undefined) {
      window.clearTimeout(allowCloseTimeoutRef.current)
      allowCloseTimeoutRef.current = undefined
    }
  }, [])

  const grantClosePermission = React.useCallback(() => {
    allowCloseRef.current = true
    // Clear any existing timeout to reset the permission window
    if (allowCloseTimeoutRef.current !== undefined)
      window.clearTimeout(allowCloseTimeoutRef.current)

    allowCloseTimeoutRef.current = window.setTimeout(() => {
      allowCloseRef.current = false
      allowCloseTimeoutRef.current = undefined
    }, CLOSE_PERMISSION_MS)
  }, [])

  const setOpenState = React.useCallback((next: boolean) => {
    if (!isControlled)
      setUncontrolledOpen(next)
  }, [isControlled])

  const handleOpenChange = React.useCallback((next: boolean) => {
    if (!isFirefoxMode) {
      onOpenChange?.(next)
      setOpenState(next)
      return
    }

    if (next) {
      // Ensure guards read the latest state before Radix replays close requests
      openRef.current = true
      justOpenedRef.current = true
      allowCloseRef.current = false
      clearAllowCloseTimeout()
      clearDebounce()
      setOpenState(true)
      onOpenChange?.(true)
      debounceTimeoutRef.current = window.setTimeout(() => {
        justOpenedRef.current = false
        debounceTimeoutRef.current = undefined
      }, JUST_OPENED_DEBOUNCE_MS)
      return
    }

    if (justOpenedRef.current || !allowCloseRef.current) {
      openRef.current = true
      setOpenState(true)
      return
    }

    allowCloseRef.current = false
    clearAllowCloseTimeout()
    openRef.current = false
    setOpenState(false)
    onOpenChange?.(false)
  }, [clearAllowCloseTimeout, clearDebounce, isFirefoxMode, onOpenChange, setOpenState])

  React.useEffect(() => {
    openRef.current = open ?? false
  }, [open])

  // Register guard as early as possible so preventDismiss sees it synchronously
  React.useLayoutEffect(() => {
    if (!isFirefoxMode)
      return

    const guard: FirefoxOutsideInteractionGuard = (_event) => {
      if (!openRef.current)
        return false
      if (justOpenedRef.current)
        return true
      return !allowCloseRef.current
    }

    registerFirefoxOutsideGuard(guard)

    return () => {
      unregisterFirefoxOutsideGuard(guard)
    }
  }, [isFirefoxMode])

  React.useEffect(() => {
    if (!isFirefoxMode)
      return

    return () => {
      clearDebounce()
      clearAllowCloseTimeout()
    }
  }, [clearAllowCloseTimeout, clearDebounce, isFirefoxMode])

  React.useEffect(() => {
    if (!isFirefoxMode)
      return

    const handlePointerDown = (event: PointerEvent) => {
      const path = getComposedEventPath(event)
      const target = toElement(event.target)

      const isTriggerHit = matchesAnySelector(target, triggerSelectors, path)
      const isInteractiveHit = matchesAnySelector(target, interactiveSelectors, path)

      if (isTriggerHit || isInteractiveHit) {
        if (openRef.current)
          grantClosePermission()
        return
      }

      if (!openRef.current || justOpenedRef.current)
        return

      if (!matchesAnySelector(target, [contentSelector], path))
        grantClosePermission()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ESCAPE_KEY)
        return

      if (!openRef.current)
        return

      grantClosePermission()
      event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function')
        event.stopImmediatePropagation()
      event.preventDefault()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contentSelector, grantClosePermission, interactiveSelectors, isFirefoxMode, triggerSelectors])

  return {
    isFirefoxMode,
    rootOpen: isFirefoxMode ? (open ?? false) : controlledOpen,
    rootDefaultOpen: isFirefoxMode ? undefined : defaultOpen,
    handleOpenChange,
    grantClosePermission,
  }
}
