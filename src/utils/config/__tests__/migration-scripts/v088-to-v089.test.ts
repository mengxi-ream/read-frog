import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v088-to-v089"

describe("v088-to-v089 migration", () => {
  it("adds Translation Hub preferences with the existing default behavior", () => {
    expect(migrate({ language: { sourceCode: "auto", targetCode: "cmn" } })).toEqual({
      language: { sourceCode: "auto", targetCode: "cmn" },
      translationHub: { selectedProviderIds: null },
    })
  })

  it("preserves existing Translation Hub preferences", () => {
    const config = {
      translationHub: { selectedProviderIds: ["provider-1"] },
    }
    const migrated = migrate(config)

    expect(migrated).toEqual(config)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
    expect(migrate([])).toEqual([])
  })
})
