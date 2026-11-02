import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v116-to-v117"

describe("v116-to-v117 migration", () => {
  it("adds pause-on-hover, off", () => {
    const oldConfig = { videoSubtitles: { enabled: true, aiSegmentation: false } }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: { enabled: true, aiSegmentation: false, pauseOnHover: false },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a choice the reader already made", () => {
    const config = { videoSubtitles: { pauseOnHover: true } }

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
