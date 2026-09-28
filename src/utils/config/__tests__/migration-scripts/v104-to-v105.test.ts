import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v104-to-v105"

function storedConfig(customActions: any[] = []): any {
  return {
    uiLanguage: "zh-CN",
    selectionToolbar: {
      enabled: true,
      features: { translate: { enabled: true }, speak: { enabled: false } },
      builtInActions: {
        dictionary: { enabled: true, providerId: "read-frog-free-ai" },
        sentenceAnalysis: { enabled: false, providerId: "read-frog-free-ai" },
      },
      customActions,
    },
  }
}

describe("v104 -> v105 migration", () => {
  it("seeds the toolbar order the toolbar already had, with every item pinned", () => {
    const old = storedConfig([{ id: "b-action" }, { id: "a-action" }])
    const migrated = migrate(old)

    expect(migrated.selectionToolbar.order).toEqual([
      "translate",
      "speak",
      "default-dictionary",
      "default-sentence-analysis",
      "b-action",
      "a-action",
    ])
    expect(migrated.selectionToolbar.unpinned).toEqual([])
    // Enabled or not, every item gets its place; nothing else changes.
    expect(migrated.selectionToolbar.features).toBe(old.selectionToolbar.features)
    expect(migrated.selectionToolbar.builtInActions).toBe(old.selectionToolbar.builtInActions)
    expect(migrated.selectionToolbar.customActions).toBe(old.selectionToolbar.customActions)
    expect(migrated.uiLanguage).toBe("zh-CN")
    expect(old.selectionToolbar).not.toHaveProperty("order")
  })

  it("lists only the toolbar's own items without custom actions", () => {
    expect(migrate(storedConfig()).selectionToolbar.order).toEqual([
      "translate",
      "speak",
      "default-dictionary",
      "default-sentence-analysis",
    ])
  })

  it("skips custom actions without a usable id, and duplicates", () => {
    const migrated = migrate(
      storedConfig([{ id: "x" }, { name: "no id" }, null, { id: "x" }, { id: "" }]),
    )
    expect(migrated.selectionToolbar.order.slice(4)).toEqual(["x"])
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
