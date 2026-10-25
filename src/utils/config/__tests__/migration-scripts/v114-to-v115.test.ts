import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v114-to-v115"

describe("v114-to-v115 migration", () => {
  it("points a click on a subtitle word at Dictionary", () => {
    const oldConfig = { videoSubtitles: { enabled: true } }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: { enabled: true, wordLookupActionId: "default-dictionary" },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps an action the reader already picked", () => {
    const config = { videoSubtitles: { wordLookupActionId: "my-action" } }

    expect(migrate(config)).toBe(config)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: null })).toEqual({ videoSubtitles: null })
    expect(migrate({ videoSubtitles: [] })).toEqual({ videoSubtitles: [] })
  })
})
