import { describe, expect, it } from "vitest"
import { shortcutSchema } from "@/types/config/shortcut"
import {
  formatShortcut,
  formatShortcutParts,
  isSameShortcut,
  isValidShortcut,
  keyboardEventToShortcut,
  normalizeShortcut,
} from "../shortcut"

// The recorder reads only these fields from a keydown.
function keydown(
  init: Pick<KeyboardEvent, "key" | "code"> &
    Partial<Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">>,
): KeyboardEvent {
  return {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...init,
  } as KeyboardEvent
}

describe("shortcut helpers", () => {
  it("normalizes shortcuts to a portable Mod-based format", () => {
    expect(normalizeShortcut("Ctrl+e", "windows")).toBe("Mod+E")
    expect(normalizeShortcut("Meta+e", "mac")).toBe("Mod+E")
    expect(normalizeShortcut("Control+Alt+Shift+k", "windows")).toBe("Mod+Alt+Shift+K")
  })

  it("formats shortcuts for platform-native display", () => {
    // macOS lists modifiers in Apple's Control, Option, Shift, Command order.
    expect(formatShortcut("Mod+Shift+K", "mac")).toBe("⇧ ⌘ K")
    expect(formatShortcut("Mod+Shift+K", "windows")).toBe("Ctrl+Shift+K")
  })

  it("splits shortcuts into display parts, keeping a literal plus key", () => {
    expect(formatShortcutParts("Mod+Shift+K", "mac")).toEqual(["⇧", "⌘", "K"])
    expect(formatShortcutParts("Mod+Shift+K", "windows")).toEqual(["Ctrl", "Shift", "K"])
    expect(formatShortcutParts("Mod+Shift++", "windows")).toEqual(["Ctrl", "Shift", "+"])
    expect(formatShortcutParts("", "windows")).toEqual([])
  })

  it("validates configured shortcuts while rejecting single keys and modifier-only shortcuts", () => {
    expect(isValidShortcut("Alt+E", "windows")).toBe(true)
    expect(isValidShortcut("Alt+T", "mac")).toBe(true)
    expect(isValidShortcut("Mod+K", "mac")).toBe(true)
    expect(isValidShortcut("K", "windows")).toBe(false)
    expect(isValidShortcut("Mod", "windows")).toBe(false)
  })

  it("compares shortcuts by the keys they press, never matching an empty one", () => {
    expect(isSameShortcut("Alt+Shift+D", "Shift+Alt+d", "windows")).toBe(true)
    expect(isSameShortcut("Ctrl+K", "Mod+K", "windows")).toBe(true)
    expect(isSameShortcut("Meta+K", "Mod+K", "mac")).toBe(true)
    expect(isSameShortcut("Alt+D", "Alt+Shift+D", "mac")).toBe(false)
    expect(isSameShortcut("", "", "mac")).toBe(false)
    expect(isSameShortcut("Alt+D", undefined, "mac")).toBe(false)
  })

  // The Turkish Q layout types a dotless "ı" on the I key. The hotkeys library
  // fires an I shortcut on that key, so it has to be recorded and compared as I.
  it("records and compares the Turkish dotless i as I", () => {
    expect(
      keyboardEventToShortcut(keydown({ key: "ı", code: "KeyI", ctrlKey: true }), "windows"),
    ).toBe("Mod+I")
    expect(keyboardEventToShortcut(keydown({ key: "ı", code: "KeyI", metaKey: true }), "mac")).toBe(
      "Mod+I",
    )
    expect(keyboardEventToShortcut(keydown({ key: "ı", code: "KeyI", ctrlKey: true }), "mac")).toBe(
      "Control+I",
    )
    expect(normalizeShortcut("Control+ı", "windows")).toBe("Mod+I")
    expect(isSameShortcut("Mod+ı", "Mod+I", "windows")).toBe(true)
    expect(isSameShortcut("Mod+ı", "Mod+I", "mac")).toBe(true)
  })

  it("accepts valid shortcuts in the schema and rejects incomplete ones", () => {
    expect(shortcutSchema.safeParse("Alt+E").success).toBe(true)
    expect(shortcutSchema.safeParse("").success).toBe(true)
    expect(shortcutSchema.safeParse("K").success).toBe(false)
    expect(shortcutSchema.safeParse("Mod").success).toBe(false)
  })
})
