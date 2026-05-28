import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v072-to-v073"

describe("v072-to-v073 migration", () => {
  it("adds the default timeout to translation and subtitle request queue configs", () => {
    const migrated = migrate({
      translate: {
        requestQueueConfig: {
          capacity: 60,
          rate: 8,
        },
      },
      videoSubtitles: {
        requestQueueConfig: {
          capacity: 30,
          rate: 4,
        },
      },
    })

    expect(migrated.translate.requestQueueConfig).toEqual({
      capacity: 60,
      rate: 8,
      timeoutMs: 20_000,
    })
    expect(migrated.videoSubtitles.requestQueueConfig).toEqual({
      capacity: 30,
      rate: 4,
      timeoutMs: 20_000,
    })
  })

  it("preserves existing timeout values", () => {
    const migrated = migrate({
      translate: {
        requestQueueConfig: {
          capacity: 60,
          rate: 8,
          timeoutMs: 45_000,
        },
      },
      videoSubtitles: {
        requestQueueConfig: {
          capacity: 30,
          rate: 4,
          timeoutMs: 90_000,
        },
      },
    })

    expect(migrated.translate.requestQueueConfig.timeoutMs).toBe(45_000)
    expect(migrated.videoSubtitles.requestQueueConfig.timeoutMs).toBe(90_000)
  })

  it("preserves malformed config shapes as much as possible", () => {
    const migrated = migrate({})

    expect(migrated.translate.requestQueueConfig.timeoutMs).toBe(20_000)
    expect(migrated.videoSubtitles.requestQueueConfig.timeoutMs).toBe(20_000)
  })
})
