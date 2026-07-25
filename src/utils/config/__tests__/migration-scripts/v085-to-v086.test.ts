import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v085-to-v086"

describe("v085-to-v086 migration", () => {
  it("adds saveSuggestion with enabled default", () => {
    const migrated = migrate({
      selectionToolbar: { enabled: true, customActions: [] },
    })
    expect(migrated.selectionToolbar.saveSuggestion).toEqual({ enabled: true })
  })

  it("preserves an already-set saveSuggestion (idempotent)", () => {
    const migrated = migrate({
      selectionToolbar: { enabled: true, saveSuggestion: { enabled: false } },
    })
    expect(migrated.selectionToolbar.saveSuggestion).toEqual({ enabled: false })
  })

  it("leaves other selectionToolbar fields and top-level fields untouched", () => {
    const migrated = migrate({
      uiLanguage: "ja",
      selectionToolbar: { enabled: false, opacity: 80, customActions: [] },
    })
    expect(migrated.uiLanguage).toBe("ja")
    expect(migrated.selectionToolbar.enabled).toBe(false)
    expect(migrated.selectionToolbar.opacity).toBe(80)
    expect(migrated.selectionToolbar.customActions).toEqual([])
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
  })
})
