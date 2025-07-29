type OS = 'Windows' | 'MacOS' | 'Linux' | 'iOS' | 'Android' | 'Unknown'
type Key = 'alt' | 'ctrl' | 'shift' | 'enter' | 'backspace' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j'
  | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'

function detectOS(): OS {
  if (typeof navigator === 'undefined')
    return 'Unknown'

  // Modern browsers expose navigator.userAgentData.platform
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || navigator.userAgent || ''

  if (/Win/i.test(platform))
    return 'Windows'
  if (/Mac/i.test(platform))
    return 'MacOS'
  if (/Linux/i.test(platform))
    return 'Linux'
  if (/iPhone|iPad|iPod|iOS/i.test(platform))
    return 'iOS'
  if (/Android/i.test(platform))
    return 'Android'
  return 'Unknown'
}

export function formatHotkey(keys: Key[]): string {
  const os = detectOS()

  // Define your mappings per platform
  const keyMap: Record<string, string>
    = os === 'MacOS'
      ? {
          // Option is the Mac equivalent of Alt
          alt: 'Option',
          ctrl: '⌘',
          shift: '⇧',
          enter: '↩︎',
          backspace: '⌫',
        }
      : {
          alt: 'Alt',
          ctrl: 'Ctrl',
          shift: 'Shift',
          enter: 'Enter',
          backspace: 'Backspace',
        }

  // Map each key, fall back to uppercase raw if unknown
  const parts = keys.map((k) => {
    const key = k.toLowerCase()
    return keyMap[key] ?? k.toUpperCase()
  })

  return parts.join(' + ')
}
