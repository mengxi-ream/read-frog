import { describe, expect, it } from "vitest"
import { shortcutSchema } from "@/types/config/shortcut"
import {
  formatShortcut,
  formatShortcutParts,
  isSameShortcut,
  isValidShortcut,
  normalizeShortcut,
} from "../shortcut"

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

  it("accepts valid shortcuts in the schema and rejects incomplete ones", () => {
    expect(shortcutSchema.safeParse("Alt+E").success).toBe(true)
    expect(shortcutSchema.safeParse("").success).toBe(true)
    expect(shortcutSchema.safeParse("K").success).toBe(false)
    expect(shortcutSchema.safeParse("Mod").success).toBe(false)
  })
})
