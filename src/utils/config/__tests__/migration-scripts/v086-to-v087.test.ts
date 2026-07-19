import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v086-to-v087"

describe("v086-to-v087 migration", () => {
  it("adds translate.vocabulary with familiarWordRank default", () => {
    const migrated = migrate({
      translate: { mode: "bilingual", providerId: "microsoft-translate-default" },
    })
    expect(migrated.translate.vocabulary).toEqual({ familiarWordRank: 5000 })
  })

  it("preserves an already-set vocabulary config (idempotent)", () => {
    const migrated = migrate({
      translate: { mode: "vocabulary", vocabulary: { familiarWordRank: 3000 } },
    })
    expect(migrated.translate.vocabulary).toEqual({ familiarWordRank: 3000 })
  })

  it("leaves other translate fields and top-level fields untouched", () => {
    const migrated = migrate({
      uiLanguage: "ja",
      translate: { mode: "translationOnly", providerId: "some-provider" },
    })
    expect(migrated.uiLanguage).toBe("ja")
    expect(migrated.translate.mode).toBe("translationOnly")
    expect(migrated.translate.providerId).toBe("some-provider")
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
  })
})
