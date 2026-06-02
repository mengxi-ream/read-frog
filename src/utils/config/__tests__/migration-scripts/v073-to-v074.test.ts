import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v073-to-v074"

describe("v073-to-v074 migration", () => {
  it("adds translationHub.selectedProviderIds defaulting to null", () => {
    const migrated = migrate({
      language: { sourceCode: "auto", targetCode: "cmn", level: "intermediate" },
    })

    expect(migrated.translationHub).toEqual({ selectedProviderIds: null })
  })

  it("preserves an existing selection", () => {
    const migrated = migrate({
      translationHub: { selectedProviderIds: ["openai-default"] },
    })

    expect(migrated.translationHub.selectedProviderIds).toEqual(["openai-default"])
  })

  it("preserves an explicit empty selection", () => {
    const migrated = migrate({
      translationHub: { selectedProviderIds: [] },
    })

    expect(migrated.translationHub.selectedProviderIds).toEqual([])
  })

  it("handles malformed config shapes", () => {
    expect(migrate({}).translationHub.selectedProviderIds).toBe(null)
  })
})
