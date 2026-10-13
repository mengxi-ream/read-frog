import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v111-to-v112"

const DEFAULT_WORD_LOOKUP = {
  clickActionId: "default-dictionary",
  dragActionId: "default-sentence-analysis",
}

describe("v111-to-v112 migration", () => {
  it("points a click at Dictionary and a drag at Sentence Analysis", () => {
    const oldConfig = {
      selectionToolbar: { customActions: [] },
      videoSubtitles: { enabled: true },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      selectionToolbar: { customActions: [] },
      videoSubtitles: { enabled: true },
      wordLookup: DEFAULT_WORD_LOOKUP,
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps actions the reader already picked when rerun", () => {
    const oldConfig = { wordLookup: { clickActionId: "my-word", dragActionId: "my-sentence" } }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({ wordLookup: null })).toEqual({ wordLookup: DEFAULT_WORD_LOOKUP })
  })
})
