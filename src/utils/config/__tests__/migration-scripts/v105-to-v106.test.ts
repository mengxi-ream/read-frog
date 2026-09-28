import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v105-to-v106"

function storedConfig(customActions: any[] = [], improveWritingEnabled = false): any {
  return {
    uiLanguage: "zh-CN",
    selectionToolbar: {
      enabled: true,
      features: { translate: { enabled: true }, speak: { enabled: false } },
      builtInActions: {
        dictionary: { enabled: true, providerId: "read-frog-free-ai" },
        sentenceAnalysis: { enabled: false, providerId: "read-frog-free-ai" },
        improveWriting: { enabled: improveWritingEnabled, providerId: "deepseek-default" },
      },
      customActions,
    },
  }
}

describe("v105 -> v106 migration", () => {
  it("seeds the toolbar order the toolbar already had", () => {
    const old = storedConfig([{ id: "b-action" }, { id: "a-action" }])
    const migrated = migrate(old)

    expect(migrated.selectionToolbar.order).toEqual([
      "translate",
      "speak",
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
      "b-action",
      "a-action",
    ])
    // Enabled or not, every item gets its place; nothing else changes.
    expect(migrated.selectionToolbar.features).toBe(old.selectionToolbar.features)
    expect(migrated.selectionToolbar.builtInActions.dictionary).toBe(
      old.selectionToolbar.builtInActions.dictionary,
    )
    expect(migrated.selectionToolbar.customActions).toBe(old.selectionToolbar.customActions)
    expect(migrated.uiLanguage).toBe("zh-CN")
    expect(old.selectionToolbar).not.toHaveProperty("order")
  })

  it("turns on the built-in Improve Writing it came off, and keeps it off the toolbar", () => {
    const old = storedConfig()
    const migrated = migrate(old)
    expect(migrated.selectionToolbar.builtInActions.improveWriting).toEqual({
      enabled: true,
      providerId: "deepseek-default",
    })
    expect(migrated.selectionToolbar.unpinned).toEqual(["default-improve-writing"])
    expect(old.selectionToolbar.builtInActions.improveWriting.enabled).toBe(false)
  })

  it("keeps an Improve Writing the user turned on where it is, on the toolbar", () => {
    const old = storedConfig([], true)
    const migrated = migrate(old)
    expect(migrated.selectionToolbar.builtInActions).toBe(old.selectionToolbar.builtInActions)
    expect(migrated.selectionToolbar.unpinned).toEqual([])
  })

  it("skips custom actions without a usable id, and duplicates", () => {
    const migrated = migrate(
      storedConfig([{ id: "x" }, { name: "no id" }, null, { id: "x" }, { id: "" }]),
    )
    expect(migrated.selectionToolbar.order.slice(5)).toEqual(["x"])
  })

  it("completes a config a UI context saved with the schema's empty lists first", () => {
    // Parsed ahead of this migration, then saved with a setting: both lists
    // are there, empty, and Improve Writing is still off.
    const old = storedConfig([{ id: "x" }])
    old.selectionToolbar.order = []
    old.selectionToolbar.unpinned = []
    const migrated = migrate(old)

    expect(migrated.selectionToolbar.order).toEqual([
      "translate",
      "speak",
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
      "x",
    ])
    expect(migrated.selectionToolbar.builtInActions.improveWriting.enabled).toBe(true)
    expect(migrated.selectionToolbar.unpinned).toEqual(["default-improve-writing"])
  })

  it("keeps an order and pins already there, adding Improve Writing to the unpinned", () => {
    const old = storedConfig()
    old.selectionToolbar.order = ["speak", "translate"]
    old.selectionToolbar.unpinned = ["speak"]
    const migrated = migrate(old)
    expect(migrated.selectionToolbar.order).toBe(old.selectionToolbar.order)
    expect(migrated.selectionToolbar.unpinned).toEqual(["speak", "default-improve-writing"])
  })

  it("returns a config that needs nothing by identity", () => {
    const once = migrate(storedConfig([{ id: "x" }]))
    expect(migrate(once)).toBe(once)

    const done = storedConfig([], true)
    done.selectionToolbar.order = ["speak", "translate"]
    done.selectionToolbar.unpinned = []
    expect(migrate(done)).toBe(done)
  })

  it("leaves configs without a selection toolbar for the schema to report", () => {
    const config = { uiLanguage: "en" }
    expect(migrate(config)).toBe(config)
    expect(migrate(null)).toBeNull()
  })
})
