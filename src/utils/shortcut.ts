import {
  detectPlatform,
  formatForDisplay,
  hasNonModifierKey,
  normalizeKeyName,
  parseHotkey,
  PUNCTUATION_CODE_MAP,
  validateHotkey,
} from "@tanstack/hotkeys"

export type HotkeyPlatform = ReturnType<typeof detectPlatform>

const LETTER_CODE_RE = /^[A-Z]$/i
const DIGIT_CODE_RE = /^\d$/

export function isShortcutEmpty(hotkey: string | null | undefined): boolean {
  return !hotkey?.trim()
}

export function formatShortcut(
  hotkey: string | null | undefined,
  platform?: HotkeyPlatform,
): string {
  if (isShortcutEmpty(hotkey)) {
    return ""
  }

  const configuredHotkey = hotkey?.trim() ?? ""
  return formatForDisplay(configuredHotkey, platform ? { platform } : undefined)
}

export function formatShortcutParts(
  hotkey: string | null | undefined,
  platform?: HotkeyPlatform,
): string[] {
  if (isShortcutEmpty(hotkey)) {
    return []
  }

  // Ask the library for the parts instead of splitting its display string: on
  // Windows/Linux the parts are joined with "+", which is also a valid key ("Mod++").
  const configuredHotkey = hotkey?.trim() ?? ""
  return formatForDisplay(configuredHotkey, platform ? { platform, parts: true } : { parts: true })
}

export function isValidShortcut(
  hotkey: string,
  platform: HotkeyPlatform = detectPlatform(),
): boolean {
  const normalizedHotkey = normalizeShortcut(hotkey, platform)
  if (!normalizedHotkey) {
    return false
  }

  const parsedHotkey = parseHotkey(normalizedHotkey, platform)
  return parsedHotkey.modifiers.length > 0 && hasNonModifierKey(parsedHotkey, platform)
}

export function normalizeShortcut(
  hotkey: string,
  platform: HotkeyPlatform = detectPlatform(),
): string | null {
  if (isShortcutEmpty(hotkey)) {
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
  const shouldUseMod =
    platform === "mac"
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

// Whether two configured shortcuts press the same keys, however each is
// written ("Shift+Alt+d" and "Alt+Shift+D" do). An empty one matches nothing.
export function isSameShortcut(
  left: string | null | undefined,
  right: string | null | undefined,
  platform: HotkeyPlatform = detectPlatform(),
): boolean {
  if (isShortcutEmpty(left) || isShortcutEmpty(right)) {
    return false
  }

  const normalizedLeft = normalizeShortcut(left!, platform)
  const normalizedRight = normalizeShortcut(right!, platform)
  return !!normalizedLeft && normalizedLeft.toLowerCase() === normalizedRight?.toLowerCase()
}

export function keyboardEventToShortcut(
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
  return normalizeShortcut(parts.join("+"), platform)
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
      return PUNCTUATION_CODE_MAP[event.code]!
    }
  }

  return normalizedKey
}
