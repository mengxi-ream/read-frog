import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v072-to-v073"

describe("v072-to-v073 migration", () => {
  it("adds videoSubtitles.style.blurTranslation with a default false value", () => {
    const migrated = migrate({
      videoSubtitles: {
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
        },
      },
    })

    expect(migrated.videoSubtitles.style.blurTranslation).toBe(false)
  })

  it("preserves an existing videoSubtitles.style.blurTranslation value", () => {
    const migrated = migrate({
      videoSubtitles: {
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          blurTranslation: true,
        },
      },
    })

    expect(migrated.videoSubtitles.style.blurTranslation).toBe(true)
  })
})
