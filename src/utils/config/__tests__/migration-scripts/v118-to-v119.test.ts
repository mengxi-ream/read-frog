import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v118-to-v119"

function configWith({
  annotation = { enabled: true, shortcut: "Alt+Shift+E" },
  customShortcut,
  node,
}: {
  annotation?: Record<string, unknown>
  customShortcut?: string
  node?: Record<string, unknown>
} = {}) {
  return {
    pageTranslation: {
      page: { shortcut: "Alt+E" },
      modeShortcut: "Alt+Shift+M",
      node: { enabled: true, hotkey: "control", shortcut: "Alt+Q", ...node },
    },
    selectionToolbar: {
      features: {
        translate: { enabled: true, shortcut: "Alt+T" },
        speak: { enabled: true, shortcut: "Alt+Shift+R" },
      },
      annotation,
      builtInActions: {
        dictionary: { enabled: true, shortcut: "Alt+Shift+D" },
      },
      customActions:
        customShortcut === undefined ? [] : [{ id: "custom-1", shortcut: customShortcut }],
    },
    videoSubtitles: { toggleShortcut: "Alt+C" },
    translationHub: { shortcut: "Alt+Shift+H" },
  }
}

describe("v118-to-v119 migration", () => {
  it("gives annotation mode its key, Alt+Shift+P", () => {
    const oldConfig = configWith()
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.annotation).toEqual({
      enabled: true,
      shortcut: "Alt+Shift+E",
      modeShortcut: "Alt+Shift+P",
    })
    expect(migrated.selectionToolbar.builtInActions).toBe(oldConfig.selectionToolbar.builtInActions)
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a key the reader already chose, or cleared", () => {
    const chosen = configWith({ annotation: { enabled: true, modeShortcut: "Alt+Shift+K" } })
    const cleared = configWith({ annotation: { enabled: false, modeShortcut: "" } })

    expect(migrate(chosen)).toBe(chosen)
    expect(migrate(cleared)).toBe(cleared)
  })

  it("does not take a key another shortcut already has, however it is written", () => {
    const migrated = migrate(configWith({ customShortcut: "shift+option+p" }))

    expect(migrated.selectionToolbar.annotation.modeShortcut).toBe("")
  })

  it("counts hover translation's key only while hover translation uses it", () => {
    const unused = migrate(configWith({ node: { hotkey: "control", shortcut: "Alt+Shift+P" } }))
    const used = migrate(configWith({ node: { hotkey: "custom", shortcut: "Alt+Shift+P" } }))

    expect(unused.selectionToolbar.annotation.modeShortcut).toBe("Alt+Shift+P")
    expect(used.selectionToolbar.annotation.modeShortcut).toBe("")
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ selectionToolbar: null })).toEqual({ selectionToolbar: null })
    expect(migrate({ selectionToolbar: {} })).toEqual({ selectionToolbar: {} })
    expect(migrate({ selectionToolbar: { annotation: [] } })).toEqual({
      selectionToolbar: { annotation: [] },
    })
  })
})
