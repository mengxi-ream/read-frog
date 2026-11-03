import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v117-to-v118"

const ADDED = {
  enabled: true,
  shortcut: "Alt+Shift+V",
  lookupActionId: "default-dictionary",
}

describe("v117-to-v118 migration", () => {
  it("adds difficult words with its default key and drops the language level", () => {
    const oldConfig = {
      language: { sourceCode: "auto", targetCode: "cmn", level: "intermediate" },
      selectionToolbar: { features: { speak: { enabled: true } } },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      language: { sourceCode: "auto", targetCode: "cmn" },
      selectionToolbar: { features: { speak: { enabled: true } } },
      difficultWords: ADDED,
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it.each([
    ["page translation", { pageTranslation: { page: { shortcut: "Alt+Shift+V" } } }],
    ["translation mode", { pageTranslation: { modeShortcut: "Shift+Alt+v" } }],
    [
      "selection translation",
      { selectionToolbar: { features: { translate: { shortcut: "alt+shift+v" } } } },
    ],
    ["speak", { selectionToolbar: { features: { speak: { shortcut: "Option+Shift+V" } } } }],
    [
      "annotation",
      { selectionToolbar: { annotation: { enabled: true, shortcut: "Alt+Shift+V" } } },
    ],
    ["subtitles", { videoSubtitles: { toggleShortcut: "Alt+Shift+V" } }],
    ["Translation Hub", { translationHub: { shortcut: "Alt+Shift+V" } }],
    [
      "a built-in action",
      { selectionToolbar: { builtInActions: { dictionary: { shortcut: "Alt+Shift+V" } } } },
    ],
    [
      "a custom action",
      { selectionToolbar: { customActions: [{ id: "a", shortcut: "Alt+Shift+V" }] } },
    ],
    [
      "hover translation",
      { pageTranslation: { node: { hotkey: "custom", shortcut: "Alt+Shift+V" } } },
    ],
  ])("leaves the key empty when %s already has Alt+Shift+V", (_owner, config) => {
    expect(migrate(config).difficultWords).toEqual({ ...ADDED, shortcut: "" })
  })

  it("counts hover translation's key only while it uses a custom shortcut", () => {
    const config = { pageTranslation: { node: { hotkey: "control", shortcut: "Alt+Shift+V" } } }

    expect(migrate(config).difficultWords).toEqual(ADDED)
  })

  it("keeps the field when the reader already has it", () => {
    const config = {
      language: { sourceCode: "auto", targetCode: "eng" },
      difficultWords: { enabled: false, shortcut: "", lookupActionId: "my-action" },
    }

    expect(migrate(config)).toBe(config)
  })

  it("gives a key to a field written back without one", () => {
    // A UI context parsed the config before the migration ran and saved the defaults.
    const config = {
      translationHub: { shortcut: "Alt+Shift+V" },
      difficultWords: { enabled: false, lookupActionId: "my-action" },
    }

    expect(migrate(config).difficultWords).toEqual({
      enabled: false,
      shortcut: "",
      lookupActionId: "my-action",
    })
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate("config")).toBe("config")
  })
})
