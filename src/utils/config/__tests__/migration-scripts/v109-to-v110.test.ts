import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v109-to-v110"

function createConfig(overrides: { translateShortcut?: string; hubShortcut?: string } = {}) {
  return {
    pageTranslation: {
      modeShortcut: "Alt+Shift+M",
      page: { shortcut: "Alt+E" },
    },
    videoSubtitles: { toggleShortcut: "Alt+C" },
    translationHub: { shortcut: overrides.hubShortcut ?? "Alt+Shift+H" },
    selectionToolbar: {
      features: {
        translate: {
          enabled: true,
          providerId: "microsoft-translate-default",
          shortcut: overrides.translateShortcut ?? "Alt+T",
        },
        speak: { enabled: true },
      },
      builtInActions: {
        dictionary: { enabled: true, providerId: "read-frog-free-ai" },
        sentenceAnalysis: { enabled: false, providerId: "read-frog-free-ai" },
        improveWriting: { enabled: true, providerId: "openai-default" },
      },
      customActions: [{ id: "custom-1", name: "Mine" }],
    },
  }
}

describe("v109-to-v110 migration", () => {
  it("gives speak and the built-in actions their keys, and custom actions none", () => {
    const oldConfig = createConfig()
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.features.speak).toEqual({
      enabled: true,
      shortcut: "Alt+Shift+R",
    })
    expect(migrated.selectionToolbar.builtInActions).toEqual({
      dictionary: { enabled: true, providerId: "read-frog-free-ai", shortcut: "Alt+Shift+D" },
      sentenceAnalysis: {
        enabled: false,
        providerId: "read-frog-free-ai",
        shortcut: "Alt+Shift+G",
      },
      improveWriting: { enabled: true, providerId: "openai-default", shortcut: "Alt+Shift+W" },
    })
    expect(migrated.selectionToolbar.customActions).toEqual([{ id: "custom-1", name: "Mine" }])
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("leaves a key empty when the reader already gave it to another shortcut", () => {
    const migrated = migrate(
      createConfig({ translateShortcut: "alt+shift+d", hubShortcut: "Alt+Shift+R" }),
    )

    expect(migrated.selectionToolbar.features.speak.shortcut).toBe("")
    expect(migrated.selectionToolbar.builtInActions.dictionary.shortcut).toBe("")
    expect(migrated.selectionToolbar.builtInActions.sentenceAnalysis.shortcut).toBe("Alt+Shift+G")
  })

  it("sees a taken key however it is written", () => {
    const migrated = migrate(
      createConfig({ translateShortcut: "Shift+Alt+d", hubShortcut: "Option+Shift+R" }),
    )

    expect(migrated.selectionToolbar.features.speak.shortcut).toBe("")
    expect(migrated.selectionToolbar.builtInActions.dictionary.shortcut).toBe("")
    expect(migrated.selectionToolbar.builtInActions.improveWriting.shortcut).toBe("Alt+Shift+W")
  })

  it("does not mistake other modifiers or the plus key for a default", () => {
    const migrated = migrate(
      createConfig({ translateShortcut: "Mod+Shift+D", hubShortcut: "Alt+Shift++" }),
    )

    expect(migrated.selectionToolbar.builtInActions.dictionary.shortcut).toBe("Alt+Shift+D")
    expect(migrated.selectionToolbar.features.speak.shortcut).toBe("Alt+Shift+R")
  })

  it("keeps keys already set when rerun", () => {
    const oldConfig = createConfig()
    oldConfig.selectionToolbar.features.speak = { enabled: true, shortcut: "" } as never
    for (const state of Object.values(oldConfig.selectionToolbar.builtInActions)) {
      ;(state as Record<string, unknown>).shortcut = "Alt+Shift+K"
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("still checks the keys of a pre-v110 config a UI context parsed and wrote back first", () => {
    // A v109 config, as a UI context that loads ahead of the migration parses it.
    const { selectionToolbar } = structuredClone(DEFAULT_CONFIG)
    delete selectionToolbar.features.speak.shortcut
    for (const state of Object.values(selectionToolbar.builtInActions)) {
      delete state.shortcut
    }
    const parsed = configSchema.parse({
      ...DEFAULT_CONFIG,
      translationHub: { ...DEFAULT_CONFIG.translationHub, shortcut: "Alt+Shift+R" },
      selectionToolbar,
    })

    // Nothing is filled in for it to write back...
    expect(parsed.selectionToolbar.features.speak).not.toHaveProperty("shortcut")
    expect(parsed.selectionToolbar.builtInActions.dictionary).not.toHaveProperty("shortcut")

    // ...so the migration still sees Speak's default is the Hub's key.
    const migrated = migrate(JSON.parse(JSON.stringify(parsed)))
    expect(migrated.selectionToolbar.features.speak.shortcut).toBe("")
    expect(migrated.selectionToolbar.builtInActions.dictionary.shortcut).toBe("Alt+Shift+D")
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ selectionToolbar: null })).toEqual({ selectionToolbar: null })
    expect(migrate({ selectionToolbar: { features: [] } })).toEqual({
      selectionToolbar: { features: [] },
    })
  })
})
