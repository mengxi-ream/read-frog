import { i18n } from "#imports"
import { isModifierKey } from "@tanstack/hotkeys"
import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { formatPageTranslationShortcut, isValidConfiguredPageTranslationShortcut, keyboardEventToPageTranslationShortcut } from "@/utils/page-translation-shortcut"

const CLEAR_KEYS = new Set(["Backspace", "Delete"])

export function ShortcutKeyRecorder(
  { shortcutKey: initialShortcutKey, onChange, className }:
  { shortcutKey: string, onChange?: (shortcutKey: string) => void, className?: string },
) {
  const [inRecording, setInRecording] = useState(false)
  const [draftShortcut, setDraftShortcut] = useState("")
  const [optimisticShortcut, setOptimisticShortcut] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isRecordingRef = useRef(false)

  const endRecording = useCallback((nextShortcut: string | null) => {
    isRecordingRef.current = false
    setInRecording(false)

    if (nextShortcut !== null) {
      setDraftShortcut(nextShortcut)
      setOptimisticShortcut(nextShortcut)
      onChange?.(nextShortcut)
    }
    else {
      setDraftShortcut("")
    }

    queueMicrotask(() => {
      inputRef.current?.blur()
    })
  }, [onChange])

  const cancelRecording = useCallback(() => {
    endRecording(null)
  }, [endRecording])

  const clearShortcut = useCallback(() => {
    endRecording("")
  }, [endRecording])

  const commitShortcut = useCallback((nextShortcut: string) => {
    endRecording(nextShortcut)
  }, [endRecording])

  const startRecord = () => {
    if (isRecordingRef.current) {
      return
    }

    isRecordingRef.current = true
    setInRecording(true)
    setDraftShortcut("")
  }

  const handleBlur = () => {
    if (!isRecordingRef.current) {
      return
    }

    cancelRecording()
  }

  useEffect(() => {
    if (!inRecording) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (!isRecordingRef.current) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.key === "Escape") {
        cancelRecording()
        return
      }

      if (CLEAR_KEYS.has(event.key) && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        clearShortcut()
        return
      }

      if (isModifierKey(event)) {
        return
      }

      const normalizedHotkey = keyboardEventToPageTranslationShortcut(event)

      if (!normalizedHotkey || !isValidConfiguredPageTranslationShortcut(normalizedHotkey)) {
        return
      }

      commitShortcut(normalizedHotkey)
    }

    document.addEventListener("keydown", handleKeydown, true)
    return () => {
      document.removeEventListener("keydown", handleKeydown, true)
    }
  }, [cancelRecording, clearShortcut, commitShortcut, inRecording])

  const shortcutKey = optimisticShortcut !== null && optimisticShortcut !== initialShortcutKey
    ? optimisticShortcut
    : initialShortcutKey

  return (
    <Input
      ref={inputRef}
      className={className}
      onFocus={startRecord}
      onBlur={handleBlur}
      value={formatPageTranslationShortcut(inRecording ? draftShortcut : shortcutKey)}
      placeholder={i18n.t("shortcutKeySelector.placeholder")}
      readOnly
    />
  )
}
