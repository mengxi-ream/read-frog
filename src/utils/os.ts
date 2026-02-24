type OS = "Windows" | "MacOS" | "Linux" | "iOS" | "Android" | "Unknown"

function detectOS(): OS {
  if (typeof navigator === "undefined")
    return "Unknown"

  // Modern browsers expose navigator.userAgentData.platform
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || navigator.userAgent || ""

  if (/Win/i.test(platform))
    return "Windows"
  if (/Mac/i.test(platform))
    return "MacOS"
  if (/Linux/i.test(platform))
    return "Linux"
  if (/iPhone|iPad|iPod|iOS/i.test(platform))
    return "iOS"
  if (/Android/i.test(platform))
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
