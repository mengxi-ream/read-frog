/**
 * Migration script from v065 to v066
 * - Converts `translate.page.shortcut` from string[] to portable hotkey string
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const FALLBACK_SHORTCUT = "Alt+E"

function normalizeLegacyHotkeyKey(key: string): string {
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    return ""
  }

  const lowerKey = trimmedKey.toLowerCase()
  const aliases: Record<string, string> = {
    backspace: "Backspace",
    delete: "Delete",
    down: "ArrowDown",
    enter: "Enter",
    esc: "Escape",
    escape: "Escape",
    left: "ArrowLeft",
    return: "Enter",
    right: "ArrowRight",
    space: "Space",
    tab: "Tab",
    up: "ArrowUp",
  }

  if (aliases[lowerKey]) {
    return aliases[lowerKey]
  }

  if (trimmedKey.length === 1) {
    return trimmedKey.toUpperCase()
  }

  return trimmedKey
}

function migrateLegacyShortcut(legacyShortcut: unknown): string {
  if (!Array.isArray(legacyShortcut) || legacyShortcut.length === 0) {
    return FALLBACK_SHORTCUT
  }

  let hasMod = false
  let hasAlt = false
  let hasShift = false
  let key = ""

  for (const token of legacyShortcut) {
    if (typeof token !== "string") {
      return FALLBACK_SHORTCUT
    }

    const normalizedToken = token.trim().toLowerCase()
    if (!normalizedToken) {
      return FALLBACK_SHORTCUT
    }

    if (normalizedToken === "ctrl" || normalizedToken === "control" || normalizedToken === "command" || normalizedToken === "meta") {
      hasMod = true
      continue
    }

    if (normalizedToken === "alt" || normalizedToken === "option") {
      hasAlt = true
      continue
    }

    if (normalizedToken === "shift") {
      hasShift = true
      continue
    }

    if (key) {
      return FALLBACK_SHORTCUT
    }

    key = normalizeLegacyHotkeyKey(token)
  }

  if (!key || (!hasMod && !hasAlt && !hasShift)) {
    return FALLBACK_SHORTCUT
  }

  return [
    hasMod ? "Mod" : null,
    hasAlt ? "Alt" : null,
    hasShift ? "Shift" : null,
    key,
  ].filter(Boolean).join("+")
}

export function migrate(oldConfig: any): any {
  const translate = oldConfig.translate
  const page = translate?.page

  if (!page) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...translate,
      page: {
        ...page,
        shortcut: migrateLegacyShortcut(page.shortcut),
      },
    },
  }
}
