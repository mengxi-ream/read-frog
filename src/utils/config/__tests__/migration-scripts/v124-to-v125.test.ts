import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrateConfig } from "../../migration"
import { migrate } from "../../migration-scripts/v124-to-v125"
import { testSeries as v124TestSeries } from "../example/v124"

describe("v124-to-v125 migration", () => {
  it("gives both request queues the 20 s timeout they always used", () => {
    const oldConfig = {
      pageTranslation: {
        providerId: "provider-1",
        requestQueueConfig: { capacity: 400, rate: 8 },
      },
      videoSubtitles: {
        enabled: true,
        requestQueueConfig: { capacity: 10, rate: 0.5 },
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      pageTranslation: {
        providerId: "provider-1",
        requestQueueConfig: { capacity: 400, rate: 8, timeoutMs: 20000 },
      },
      videoSubtitles: {
        enabled: true,
        requestQueueConfig: { capacity: 10, rate: 0.5, timeoutMs: 20000 },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a timeout already there, and fills in only the queue missing one", () => {
    const migrated = migrate({
      pageTranslation: { requestQueueConfig: { capacity: 20, rate: 8, timeoutMs: 90000 } },
      videoSubtitles: { requestQueueConfig: { capacity: 20, rate: 8 } },
    })

    expect(migrated.pageTranslation.requestQueueConfig.timeoutMs).toBe(90000)
    expect(migrated.videoSubtitles.requestQueueConfig.timeoutMs).toBe(20000)

    const complete = {
      pageTranslation: { requestQueueConfig: { capacity: 20, rate: 8, timeoutMs: 90000 } },
      videoSubtitles: { requestQueueConfig: { capacity: 20, rate: 8, timeoutMs: 45000 } },
    }
    expect(migrate(complete)).toBe(complete)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ pageTranslation: null })).toEqual({ pageTranslation: null })
    expect(migrate({ videoSubtitles: { requestQueueConfig: [] } })).toEqual({
      videoSubtitles: { requestQueueConfig: [] },
    })
    // A missing section is not created.
    expect(migrate({ pageTranslation: { requestQueueConfig: { capacity: 1, rate: 1 } } })).toEqual({
      pageTranslation: { requestQueueConfig: { capacity: 1, rate: 1, timeoutMs: 20000 } },
    })
  })

  it("produces a valid current config from every v124 series", async () => {
    for (const series of Object.values(v124TestSeries)) {
      const migrated = await migrateConfig(structuredClone(series.config), 124)
      expect(configSchema.safeParse(migrated).success).toBe(true)
      expect(migrated.pageTranslation.requestQueueConfig.timeoutMs).toBe(20000)
      expect(migrated.videoSubtitles.requestQueueConfig.timeoutMs).toBe(20000)
    }
  })
})
