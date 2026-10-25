import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v114-to-v115"

const DEFAULT_WORD_LOOKUP = {
  clickActionId: "default-dictionary",
  dragActionId: "default-sentence-analysis",
}

describe("v114-to-v115 migration", () => {
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

  it("gives a config that the v115 schema accepts", () => {
    const { wordLookup: _wordLookup, ...config } = DEFAULT_CONFIG

    const parsed = configSchema.safeParse(migrate(structuredClone(config)))

    expect(parsed.success).toBe(true)
    expect(parsed.data?.wordLookup).toEqual(DEFAULT_WORD_LOOKUP)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({ wordLookup: null })).toEqual({ wordLookup: DEFAULT_WORD_LOOKUP })
  })
})
