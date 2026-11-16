import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrateConfig } from "../../migration"
import { migrate } from "../../migration-scripts/v125-to-v126"
import { testSeries as v125TestSeries } from "../example/v125"
import { testSeries as v126TestSeries } from "../example/v126"

const ALL_OFF = {
  youtube: false,
  xcom: false,
  netflix: false,
  bilibili: false,
  udemy: false,
  edx: false,
}

describe("v125-to-v126 migration", () => {
  it("turns the auto-start switches into auto, and every other site into manual", () => {
    const oldConfig = {
      videoSubtitles: {
        enabled: true,
        autoStart: { ...ALL_OFF, youtube: true, bilibili: true },
        providerId: "microsoft-translate-default",
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: {
        platforms: {
          youtube: "auto",
          xcom: "manual",
          netflix: "manual",
          bilibili: "auto",
          udemy: "manual",
          edx: "manual",
        },
        providerId: "microsoft-translate-default",
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("turns every site off when subtitles were switched off, auto-start or not", () => {
    const migrated = migrate({
      videoSubtitles: { enabled: false, autoStart: { ...ALL_OFF, youtube: true } },
    })

    expect(migrated.videoSubtitles).toEqual({
      platforms: {
        youtube: "off",
        xcom: "off",
        netflix: "off",
        bilibili: "off",
        udemy: "off",
        edx: "off",
      },
    })
  })

  it("trusts the old switches over a `platforms` the schema defaults wrote before it ran", () => {
    const migrated = migrate({
      videoSubtitles: {
        enabled: false,
        autoStart: ALL_OFF,
        platforms: { youtube: "manual", xcom: "manual" },
      },
    })

    expect(migrated.videoSubtitles.platforms.youtube).toBe("off")
    expect(migrated.videoSubtitles.platforms.xcom).toBe("off")
  })

  it("fills in sites missing from autoStart, and copes with a malformed autoStart", () => {
    expect(
      migrate({ videoSubtitles: { enabled: true, autoStart: { youtube: true } } }).videoSubtitles
        .platforms,
    ).toEqual({
      youtube: "auto",
      xcom: "manual",
      netflix: "manual",
      bilibili: "manual",
      udemy: "manual",
      edx: "manual",
    })
    expect(
      migrate({ videoSubtitles: { enabled: true, autoStart: [] } }).videoSubtitles.platforms
        .youtube,
    ).toBe("manual")
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: null })).toEqual({ videoSubtitles: null })
    const current = { videoSubtitles: { platforms: { youtube: "auto" } } }
    expect(migrate(current)).toBe(current)
  })

  it("produces the v126 fixtures, and a valid current config, from every v125 series", async () => {
    for (const [seriesId, series] of Object.entries(v125TestSeries)) {
      const migrated = await migrateConfig(structuredClone(series.config), 125)
      expect(configSchema.safeParse(migrated).success).toBe(true)
      expect(migrated.videoSubtitles).toEqual(v126TestSeries[seriesId]!.config.videoSubtitles)
    }
  })
})
