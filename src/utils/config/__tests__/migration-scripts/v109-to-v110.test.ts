import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v109-to-v110"

describe("v109-to-v110 migration", () => {
  it("points word lookup at the built-in Dictionary", () => {
    const oldConfig = {
      selectionToolbar: { customActions: [] },
      videoSubtitles: { enabled: true },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      selectionToolbar: { customActions: [] },
      videoSubtitles: { enabled: true },
      wordLookup: { actionId: "default-dictionary" },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps an action the reader already picked when rerun", () => {
    const oldConfig = { wordLookup: { actionId: "my-action" } }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({ wordLookup: null })).toEqual({
      wordLookup: { actionId: "default-dictionary" },
    })
  })
})
