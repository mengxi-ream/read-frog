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

export function formatHotkey(keys: string[]): string {
  const os = detectOS()

  // Define your mappings per platform
  const keyMap: Record<string, string>
    = os === "MacOS"
      ? {
          // Option is the Mac equivalent of Alt
          alt: "⌥",
          ctrl: "⌃",
          shift: "⇧",
          enter: "↩︎",
          command: "⌘",
          backspace: "⌫",
          up: "↑",
          down: "↓",
          right: "→",
          left: "←",
        }
      : {
          alt: "Alt",
          ctrl: "Ctrl",
          shift: "Shift",
          enter: "Enter",
          command: "Command",
          backspace: "Backspace",
          up: "↑",
          down: "↓",
          right: "→",
          left: "←",
        }

  // Map each key, fall back to uppercase raw if unknown
  const parts = keys.map((k) => {
    const key = k.toLowerCase()
    return keyMap[key] ?? k.toUpperCase()
  })

  return parts.join(" + ")
}

export function getCommandPaletteShortcutHint(): string {
  const os = detectOS()
  return (os === "MacOS" || os === "iOS") ? "⌘K" : "Ctrl+K"
}
