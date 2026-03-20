import { describe, expect, it } from "vitest"
import { pageTranslationShortcutSchema } from "@/types/config/translate"
import { formatPageTranslationShortcut, isValidConfiguredPageTranslationShortcut, normalizePageTranslationShortcut } from "../page-translation-shortcut"

describe("page translation shortcut helpers", () => {
  it("normalizes shortcuts to a portable Mod-based format", () => {
    expect(normalizePageTranslationShortcut("Ctrl+e", "windows")).toBe("Mod+E")
    expect(normalizePageTranslationShortcut("Meta+e", "mac")).toBe("Mod+E")
    expect(normalizePageTranslationShortcut("Control+Alt+Shift+k", "windows")).toBe("Mod+Alt+Shift+K")
  })

  it("formats shortcuts for platform-native display", () => {
    expect(formatPageTranslationShortcut("Mod+Shift+K", "mac")).toBe("⇧⌘K")
    expect(formatPageTranslationShortcut("Mod+Shift+K", "windows")).toBe("Ctrl+Shift+K")
  })

  it("validates configured shortcuts while rejecting single keys and modifier-only shortcuts", () => {
    expect(isValidConfiguredPageTranslationShortcut("Alt+E", "windows")).toBe(true)
    expect(isValidConfiguredPageTranslationShortcut("Mod+K", "mac")).toBe(true)
    expect(isValidConfiguredPageTranslationShortcut("K", "windows")).toBe(false)
    expect(isValidConfiguredPageTranslationShortcut("Mod", "windows")).toBe(false)
  })

  it("accepts valid shortcuts in the schema and rejects incomplete ones", () => {
    expect(pageTranslationShortcutSchema.safeParse("Alt+E").success).toBe(true)
    expect(pageTranslationShortcutSchema.safeParse("").success).toBe(true)
    expect(pageTranslationShortcutSchema.safeParse("K").success).toBe(false)
    expect(pageTranslationShortcutSchema.safeParse("Mod").success).toBe(false)
  })
})
