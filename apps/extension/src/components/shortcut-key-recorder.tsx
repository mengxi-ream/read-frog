import { i18n } from '#imports'
import { Input } from '@repo/ui/components/input'
import hotkeys from 'hotkeys-js'
import { useEffect, useRef, useState } from 'react'
import { formatHotkey } from '@/utils/os'

const MODIFIERS = ['shift', 'alt', 'ctrl', 'command'] as const

const DISMISS_CODE = ['Space', 'Escape']

const HOTKEYS_MODIFIERS = Object.keys(hotkeys.modifier)

const SHORTCUT_KEY_SELECTOR_SCOPE = 'shortcut-key-selector'

export function ShortcutKeyRecorder(
  { shortcutKey: initialShortcutKey, onChange, className }:
  { shortcutKey: string[], onChange?: (shortcutKey: string[]) => void, className?: string },
) {
  const [inRecording, setInRecording] = useState(false)
  const [shortcutKey, setShortcutKey] = useState(initialShortcutKey)

  useEffect(() => {
    hotkeys.filter = (event: KeyboardEvent) => {
      return (event.target as HTMLInputElement).tagName === 'INPUT'
    }
  }, [])

  const formatShortcut = formatHotkey(shortcutKey)

  const recordDomRef = useRef<HTMLInputElement>(null)

  const clearHotkeys = () => setShortcutKey([])

  const resetShortcutKey = () => {
    setShortcutKey(initialShortcutKey)
    onChange?.(initialShortcutKey)
  }

  const startRecord = () => {
    hotkeys.setScope(SHORTCUT_KEY_SELECTOR_SCOPE)
    setInRecording(true)
    setShortcutKey([])
  }

  const endRecord = () => {
    // reset scope to all
    hotkeys.deleteScope(SHORTCUT_KEY_SELECTOR_SCOPE)
    setInRecording(false)
    if (shortcutKey.length === 0) {
      resetShortcutKey()
    }
  }

  useEffect(() => {
    if (isValidShortcut(shortcutKey) && inRecording) {
      recordDomRef.current?.blur()
      onChange?.(shortcutKey)
    }
  }, [shortcutKey, inRecording, onChange])

  useEffect(() => {
    hotkeys('*', { keyup: true, single: true, scope: SHORTCUT_KEY_SELECTOR_SCOPE }, (event: KeyboardEvent) => {
      if (!inRecording)
        return

      if (DISMISS_CODE.includes(event.code))
        return

      const ownModifiers = collectModifiers()

      if (!ownModifiers.length)
        return

      const pressedKeyString = hotkeys.getPressedKeyString()

      const normalKey = getNormalKey(pressedKeyString)

      const targetHotkeys = [...ownModifiers, ...normalKey]

      setShortcutKey(targetHotkeys)

      // Returning false stops the event and prevents default browser events
      return false
    })
  }, [inRecording])

  return (
    <Input
      ref={recordDomRef}
      className={className}
      onFocus={startRecord}
      onBlur={endRecord}
      onKeyUp={clearHotkeys}
      value={formatShortcut}
      placeholder={i18n.t('shortcutKeySelector.placeholder')}
      readOnly
    />
  )
}

function getNormalKey(pressedKeyString: string[]) {
  return pressedKeyString.filter(key => !HOTKEYS_MODIFIERS.includes(key))
}

function getModifiers(pressedKeyString: string[]) {
  return pressedKeyString.filter(key => HOTKEYS_MODIFIERS.includes(key))
}

function isValidShortcut(hotkeys: string[]) {
  const modifiers = getModifiers(hotkeys)
  const hasModifiers = !!modifiers.length

  const normalKey = getNormalKey(hotkeys)
  const onlyHasOneNormalKey = normalKey.length === 1
  return hasModifiers && onlyHasOneNormalKey
}

function collectModifiers() {
  const ownModifiers = MODIFIERS.filter(modifier => hotkeys[modifier])
  return Array.from(new Set(ownModifiers))
}
