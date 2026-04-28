import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v069-to-v070"

describe("v069-to-v070 migration", () => {
  it("adds the default split translator shortcut config", () => {
    const migrated = migrate({
      translate: {
        page: {
          shortcut: "Alt+E",
        },
      },
    })

    expect(migrated.translate.splitTranslator).toEqual({
      shortcut: "Alt+S",
    })
  })

  it("preserves an existing split translator shortcut config", () => {
    const migrated = migrate({
      translate: {
        page: {
          shortcut: "Alt+E",
        },
        splitTranslator: {
          shortcut: "Mod+Shift+S",
        },
      },
    })

    expect(migrated.translate.splitTranslator).toEqual({
      shortcut: "Mod+Shift+S",
    })
  })
})
