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

  it("returns a config that already has an order by identity", () => {
    const config = storedConfig()
    config.selectionToolbar.order = ["speak", "translate"]
    expect(migrate(config)).toBe(config)
  })

  it("leaves configs without a selection toolbar for the schema to report", () => {
    const config = { uiLanguage: "en" }
    expect(migrate(config)).toBe(config)
    expect(migrate(null)).toBeNull()
  })
})
