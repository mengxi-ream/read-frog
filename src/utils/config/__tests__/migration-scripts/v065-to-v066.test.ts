import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v065-to-v066"

function createConfig(shortcut: unknown, features?: Record<string, unknown>) {
  return {
    translate: {
      page: {
        shortcut,
      },
    },
    ...(features
      ? {
          selectionToolbar: {
            features,
          },
        }
      : {}),
  }
}

describe("v065-to-v066 migration", () => {
  it("converts legacy alt shortcuts to string format", () => {
    const migrated = migrate(createConfig(["alt", "e"]))

    expect(migrated.translate.page.shortcut).toBe("Alt+E")
  })

  it("folds legacy primary modifiers into Mod", () => {
    expect(migrate(createConfig(["ctrl", "e"])).translate.page.shortcut).toBe("Mod+E")
    expect(migrate(createConfig(["control", "e"])).translate.page.shortcut).toBe("Mod+E")
    expect(migrate(createConfig(["command", "e"])).translate.page.shortcut).toBe("Mod+E")
    expect(migrate(createConfig(["meta", "e"])).translate.page.shortcut).toBe("Mod+E")
  })

  it("preserves additional modifiers when migrating", () => {
    const migrated = migrate(createConfig(["command", "shift", "k"]))

    expect(migrated.translate.page.shortcut).toBe("Mod+Shift+K")
    expect(migrate(createConfig(["meta", "alt", "k"])).translate.page.shortcut).toBe("Mod+Alt+K")
  })

  it("falls back to the default shortcut for invalid legacy values", () => {
    expect(migrate(createConfig([])).translate.page.shortcut).toBe("Alt+E")
    expect(migrate(createConfig(["shift"])).translate.page.shortcut).toBe("Alt+E")
    expect(migrate(createConfig(["alt", "e", "x"])).translate.page.shortcut).toBe("Alt+E")
    expect(migrate(createConfig([""])).translate.page.shortcut).toBe("Alt+E")
  })

  it("preserves already migrated shortcut strings when rerun", () => {
    expect(migrate(createConfig("Mod+E")).translate.page.shortcut).toBe("Mod+E")
    expect(migrate(createConfig("  Alt+K  ")).translate.page.shortcut).toBe("Alt+K")
  })

  it("removes deprecated vocabulary insight config", () => {
    const migrated = migrate(createConfig(["alt", "e"], {
      speak: {
        enabled: true,
      },
      vocabularyInsight: {
        enabled: true,
        providerId: "google-default",
      },
    }))

    expect(migrated.selectionToolbar.features).toEqual({
      speak: {
        enabled: true,
      },
    })
  })
})
