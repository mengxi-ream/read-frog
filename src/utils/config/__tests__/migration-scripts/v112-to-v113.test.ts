import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrateConfig } from "../../migration"
import { migrate } from "../../migration-scripts/v112-to-v113"

describe("v112-to-v113 migration", () => {
  it("turns translate-on-open on for every platform when it was on", () => {
    const oldConfig = { videoSubtitles: { enabled: true, autoStart: true } }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: {
        enabled: true,
        autoStart: { youtube: true, xcom: true, netflix: true },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("leaves every platform off when it was off", () => {
    expect(migrate({ videoSubtitles: { autoStart: false } })).toEqual({
      videoSubtitles: { autoStart: { youtube: false, xcom: false, netflix: false } },
    })
  })

  it("treats a missing value as off", () => {
    expect(migrate({ videoSubtitles: {} })).toEqual({
      videoSubtitles: { autoStart: { youtube: false, xcom: false, netflix: false } },
    })
  })

  it("keeps per-platform switches that are already there when rerun", () => {
    const oldConfig = {
      videoSubtitles: { autoStart: { youtube: true, xcom: false, netflix: true } },
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("gives a config the current schema accepts once the rest of the chain runs", async () => {
    // v126 replaced `autoStart` with a mode per platform.
    const { platforms: _platforms, ...videoSubtitles } = DEFAULT_CONFIG.videoSubtitles
    const config = {
      ...DEFAULT_CONFIG,
      videoSubtitles: { ...videoSubtitles, enabled: true, autoStart: true },
    }

    const migrated = await migrateConfig(migrate(structuredClone(config)), 113)
    const parsed = configSchema.safeParse(migrated)

    expect(parsed.success).toBe(true)
    expect(parsed.data?.videoSubtitles.platforms).toMatchObject({
      youtube: "auto",
      xcom: "auto",
      netflix: "auto",
    })
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: null })).toEqual({ videoSubtitles: null })
    expect(migrate({ videoSubtitles: [] })).toEqual({ videoSubtitles: [] })
  })
})
