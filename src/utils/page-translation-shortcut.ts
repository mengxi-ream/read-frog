import { detectPlatform, formatForDisplay, hasNonModifierKey, normalizeKeyName, parseHotkey, PUNCTUATION_CODE_MAP, validateHotkey } from "@tanstack/hotkeys"

export type HotkeyPlatform = ReturnType<typeof detectPlatform>

const LETTER_CODE_RE = /^[A-Z]$/i
const DIGIT_CODE_RE = /^\d$/

export function isPageTranslationShortcutEmpty(hotkey: string | null | undefined): boolean {
  return !hotkey?.trim()
}

export function formatPageTranslationShortcut(hotkey: string | null | undefined, platform?: HotkeyPlatform): string {
  if (isPageTranslationShortcutEmpty(hotkey)) {
    return ""
  }

  const configuredHotkey = hotkey?.trim() ?? ""
  return formatForDisplay(configuredHotkey, platform ? { platform } : undefined)
}

export function isValidConfiguredPageTranslationShortcut(hotkey: string, platform: HotkeyPlatform = detectPlatform()): boolean {
  const normalizedHotkey = normalizePageTranslationShortcut(hotkey, platform)
  if (!normalizedHotkey) {
    return false
  }

  const parsedHotkey = parseHotkey(normalizedHotkey, platform)
  return parsedHotkey.modifiers.length > 0 && hasNonModifierKey(parsedHotkey, platform)
}

export function normalizePageTranslationShortcut(hotkey: string, platform: HotkeyPlatform = detectPlatform()): string | null {
  if (isPageTranslationShortcutEmpty(hotkey)) {
    return ""
  }

  const validation = validateHotkey(hotkey)
  if (!validation.valid) {
    return null
  }

  const parsedHotkey = parseHotkey(hotkey, platform)
  if (!parsedHotkey.key) {
    return null
  }

  const modifiers: string[] = []
  const shouldUseMod = platform === "mac"
    ? parsedHotkey.meta && !parsedHotkey.ctrl
    : parsedHotkey.ctrl && !parsedHotkey.meta

  if (shouldUseMod) {
    modifiers.push("Mod")
  }

  if (parsedHotkey.ctrl && !shouldUseMod) {
    modifiers.push("Control")
  }

  if (parsedHotkey.alt) {
    modifiers.push("Alt")
  }

  if (parsedHotkey.shift) {
    modifiers.push("Shift")
  }

  if (parsedHotkey.meta && !shouldUseMod) {
    modifiers.push("Meta")
  }

  modifiers.push(parsedHotkey.key)
  return modifiers.join("+")
}

export function keyboardEventToPageTranslationShortcut(
  event: KeyboardEvent,
  platform: HotkeyPlatform = detectPlatform(),
): string | null {
  const parts: string[] = []

  if (event.ctrlKey) {
    parts.push("Control")
  }

  if (event.altKey) {
    parts.push("Alt")
  }

  if (event.shiftKey) {
    parts.push("Shift")
  }

  if (event.metaKey) {
    parts.push("Meta")
  }

  parts.push(resolveShortcutEventKey(event))
  return normalizePageTranslationShortcut(parts.join("+"), platform)
}

function resolveShortcutEventKey(event: KeyboardEvent): string {
  const normalizedKey = normalizeKeyName(event.key)
  if (event.code && (normalizedKey === "Dead" || event.altKey)) {
    if (event.code.startsWith("Key")) {
      const codeLetter = event.code.slice(3)
      if (LETTER_CODE_RE.test(codeLetter)) {
        return codeLetter.toUpperCase()
      }
    }

    if (event.code.startsWith("Digit")) {
      const codeDigit = event.code.slice(5)
      if (DIGIT_CODE_RE.test(codeDigit)) {
        return codeDigit
      }
    }

    if (event.code in PUNCTUATION_CODE_MAP) {
      return PUNCTUATION_CODE_MAP[event.code]
    }
  }

  return normalizedKey
}
