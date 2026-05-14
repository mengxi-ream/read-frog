import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v071-to-v072"

describe("v071-to-v072 migration", () => {
  it("adds target-language precheck skipping with the existing default enabled", () => {
    const migrated = migrate({
      translate: {
        page: {
          skipLanguages: ["eng"],
        },
      },
    })

    expect(migrated.translate.page).toEqual({
      skipLanguages: ["eng"],
      enableTargetLanguageSkip: true,
    })
  })

  it("preserves malformed config shapes as much as possible", () => {
    expect(migrate({}).translate.page.enableTargetLanguageSkip).toBe(true)
  })
})
