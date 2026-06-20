import type { HotkeyPlatform } from "./page-translation-shortcut"
import { detectPlatform } from "@tanstack/hotkeys"
import {

  isPageTranslationShortcutEmpty,
  keyboardEventToPageTranslationShortcut,
  normalizePageTranslationShortcut,
} from "./page-translation-shortcut"

export function matchesNodeCustomShortcut(
  event: KeyboardEvent,
  shortcut: string,
  platform: HotkeyPlatform = detectPlatform(),
): boolean {
  if (isPageTranslationShortcutEmpty(shortcut)) {
    return false
  }

  const normalized = normalizePageTranslationShortcut(shortcut, platform)
  if (!normalized) {
    return false
  }

  const eventShortcut = keyboardEventToPageTranslationShortcut(event, platform)
  if (!eventShortcut) {
    return false
  }

  return normalized === eventShortcut
}
