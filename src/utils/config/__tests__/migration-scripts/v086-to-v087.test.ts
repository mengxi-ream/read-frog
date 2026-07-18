import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v086-to-v087"

describe("v086-to-v087 migration", () => {
  it("retires the exact frozen v9 pair {300, 5} to {60, 8}", () => {
    const migrated = migrate({
      translate: { requestQueueConfig: { capacity: 300, rate: 5 } },
      videoSubtitles: { requestQueueConfig: { capacity: 300, rate: 5 } },
    })
    expect(migrated.translate.requestQueueConfig).toEqual({ capacity: 60, rate: 8 })
    expect(migrated.videoSubtitles.requestQueueConfig).toEqual({ capacity: 60, rate: 8 })
  })

  it("leaves user-modified queue values untouched", () => {
    const migrated = migrate({
      translate: { requestQueueConfig: { capacity: 300, rate: 2 } },
      videoSubtitles: { requestQueueConfig: { capacity: 1, rate: 0.2 } },
    })
    expect(migrated.translate.requestQueueConfig).toEqual({ capacity: 300, rate: 2 })
    expect(migrated.videoSubtitles.requestQueueConfig).toEqual({ capacity: 1, rate: 0.2 })
  })

  it("is idempotent", () => {
    const input = {
      translate: { requestQueueConfig: { capacity: 60, rate: 8 }, providerId: "x" },
      videoSubtitles: { requestQueueConfig: { capacity: 5, rate: 1 } },
    }
    const once = migrate(input)
    const twice = migrate(once)
    expect(twice).toEqual(once)
  })

  it("preserves sibling fields in translate and videoSubtitles", () => {
    const migrated = migrate({
      translate: {
        providerId: "mock",
        requestQueueConfig: { capacity: 300, rate: 5 },
        batchQueueConfig: { maxCharactersPerBatch: 4000, maxItemsPerBatch: 150 },
      },
      videoSubtitles: { providerId: "mock2" },
      languageDetection: { mode: "llm", providerId: "openai-default" },
    })
    expect(migrated.translate.providerId).toBe("mock")
    expect(migrated.translate.batchQueueConfig).toEqual({
      maxCharactersPerBatch: 4000,
      maxItemsPerBatch: 150,
    })
    expect(migrated.videoSubtitles.providerId).toBe("mock2")
    // languageDetection is untouched by this migration
    expect(migrated.languageDetection).toEqual({ mode: "llm", providerId: "openai-default" })
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
  })
})
