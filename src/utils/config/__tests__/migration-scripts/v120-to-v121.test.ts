import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v120-to-v121"

describe("v120-to-v121 migration", () => {
  it("adds Bilibili, Udemy and edX with translate-on-open off", () => {
    const oldConfig = {
      videoSubtitles: { enabled: true, autoStart: { youtube: true, xcom: true, netflix: true } },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: {
        enabled: true,
        autoStart: {
          youtube: true,
          xcom: true,
          netflix: true,
          bilibili: false,
          udemy: false,
          edx: false,
        },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a new platform's switch that is already there", () => {
    const migrated = migrate({ videoSubtitles: { autoStart: { youtube: false, bilibili: true } } })

    expect(migrated.videoSubtitles.autoStart).toEqual({
      youtube: false,
      bilibili: true,
      udemy: false,
      edx: false,
    })
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: null })).toEqual({ videoSubtitles: null })
    expect(migrate({ videoSubtitles: { autoStart: true } })).toEqual({
      videoSubtitles: { autoStart: true },
    })
    expect(migrate({ videoSubtitles: { autoStart: [] } })).toEqual({
      videoSubtitles: { autoStart: [] },
    })
  })
})
