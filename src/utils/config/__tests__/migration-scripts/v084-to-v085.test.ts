import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v084-to-v085"

describe("v084-to-v085 migration", () => {
  it("adds siteRules with empty defaults", () => {
    const migrated = migrate({ uiLanguage: "auto" })
    expect(migrated.siteRules).toEqual({
      userRules: [],
      disabledBuiltInRules: [],
    })
  })

  it("preserves an already-set siteRules (idempotent)", () => {
    const existing = {
      userRules: [{ id: "my-rule", matches: "example.com", excludeSelectors: ["nav"] }],
      disabledBuiltInRules: ["github"],
    }
    const migrated = migrate({ siteRules: existing })
    expect(migrated.siteRules).toBe(existing)
  })

  it("leaves other fields untouched", () => {
    const migrated = migrate({ uiLanguage: "ja", siteControl: { mode: "blacklist" } })
    expect(migrated.uiLanguage).toBe("ja")
    expect(migrated.siteControl).toEqual({ mode: "blacklist" })
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
  })
})
