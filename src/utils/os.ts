import { formatPageTranslationShortcut } from "./page-translation-shortcut"

type OS = "Windows" | "MacOS" | "Linux" | "iOS" | "Android" | "Unknown"

const WINDOWS_PATTERN = /Win/i
const MACOS_PATTERN = /Mac/i
const LINUX_PATTERN = /Linux/i
const IOS_PATTERN = /iPhone|iPad|iPod|iOS/i
const ANDROID_PATTERN = /Android/i

function detectOS(): OS {
  if (typeof navigator === "undefined")
    return "Unknown"

  // Modern browsers expose navigator.userAgentData.platform
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || navigator.userAgent || ""

  if (WINDOWS_PATTERN.test(platform))
    return "Windows"
  if (MACOS_PATTERN.test(platform))
    return "MacOS"
  if (LINUX_PATTERN.test(platform))
    return "Linux"
  if (IOS_PATTERN.test(platform))
    return "iOS"
  if (ANDROID_PATTERN.test(platform))
    return "Android"
  return "Unknown"
}

export function formatHotkey(hotkey: string): string {
  const os = detectOS()
  const platform = os === "MacOS" ? "mac" : os === "Windows" ? "windows" : "linux"

  return formatPageTranslationShortcut(hotkey, platform)
}

export function getCommandPaletteShortcutHint(): string {
  const os = detectOS()
  return (os === "MacOS" || os === "iOS") ? "⌘K" : "Ctrl+K"
}
