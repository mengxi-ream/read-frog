// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { matchesNodeCustomShortcut } from "../node-translation-shortcut"

function ke(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { bubbles: true, ...init })
}

describe("matchesNodeCustomShortcut", () => {
  it("matches Alt+T when altKey + key t", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "t", altKey: true }), "Alt+T", "windows")).toBe(true)
  })

  it("matches Mod+E cross-platform", () => {
    // Mod means Ctrl on windows
    expect(matchesNodeCustomShortcut(ke({ key: "e", ctrlKey: true }), "Mod+E", "windows")).toBe(true)
    // Mod means Meta/Cmd on mac
    expect(matchesNodeCustomShortcut(ke({ key: "e", metaKey: true }), "Mod+E", "mac")).toBe(true)
  })

  it("matches Ctrl+Alt+T (multi-modifier)", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "t", ctrlKey: true, altKey: true }), "Ctrl+Alt+T", "windows")).toBe(true)
  })

  it("matches Ctrl+Shift+D (multi-modifier)", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "d", ctrlKey: true, shiftKey: true }), "Ctrl+Shift+D", "windows")).toBe(true)
  })

  it("rejects when a required modifier is missing", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "t", altKey: false }), "Alt+T", "windows")).toBe(false)
  })

  it("rejects when key mismatches", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "x", altKey: true }), "Alt+T", "windows")).toBe(false)
  })

  it("rejects modifier-only keydown (Alt pressed alone)", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "Alt", altKey: true }), "Alt+T", "windows")).toBe(false)
  })

  it("returns false for empty shortcut", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "t", altKey: true }), "", "windows")).toBe(false)
  })

  it("returns false for invalid shortcut string", () => {
    expect(matchesNodeCustomShortcut(ke({ key: "t", altKey: true }), "justT", "windows")).toBe(false)
  })
})
