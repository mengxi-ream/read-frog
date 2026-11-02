import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v115-to-v116"

describe("v115-to-v116 migration", () => {
  it("turns the word-annotation slot on with its default key", () => {
    const oldConfig = { selectionToolbar: { enabled: true, features: {} } }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      selectionToolbar: {
        enabled: true,
        features: {},
        annotation: { enabled: true, shortcut: "Alt+Shift+E" },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a slot the reader already configured", () => {
    const config = { selectionToolbar: { annotation: { enabled: false, shortcut: "" } } }

    expect(migrate(config)).toBe(config)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ selectionToolbar: null })).toEqual({ selectionToolbar: null })
    expect(migrate({ selectionToolbar: [] })).toEqual({ selectionToolbar: [] })
  })
})
