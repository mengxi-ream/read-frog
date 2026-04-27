import { describe, expect, it, vi } from "vitest"
import { getExtensionCommandShortcut } from "../extension-command-shortcut"

describe("getExtensionCommandShortcut", () => {
  it("returns the trimmed shortcut for the matching command", async () => {
    const shortcut = await getExtensionCommandShortcut("toggle-split-translator", {
      commands: {
        getAll: vi.fn().mockResolvedValue([
          { name: "toggle-split-translator", shortcut: " Alt+S " },
        ]),
      },
    })

    expect(shortcut).toBe("Alt+S")
  })

  it("returns an empty string when the matching command has no shortcut", async () => {
    const shortcut = await getExtensionCommandShortcut("toggle-split-translator", {
      commands: {
        getAll: vi.fn().mockResolvedValue([
          { name: "toggle-split-translator", shortcut: "" },
        ]),
      },
    })

    expect(shortcut).toBe("")
  })

  it("returns an empty string when the command is not found", async () => {
    const shortcut = await getExtensionCommandShortcut("toggle-split-translator", {
      commands: {
        getAll: vi.fn().mockResolvedValue([
          { name: "some-other-command", shortcut: "Alt+K" },
        ]),
      },
    })

    expect(shortcut).toBe("")
  })
})
