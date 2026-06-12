import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v079-to-v080"

describe("v079-to-v080 migration", () => {
  it("does not add translate config when translate is absent", () => {
    expect(migrate({})).toEqual({})
  })

  it("adds the default DOM split panel mode to translate page config", () => {
    const migrated = migrate({
      translate: {
        page: {
          sidePanelShortcut: "Alt+C",
        },
      },
    })

    expect(migrated.translate.page.splitPanelMode).toBe("dom")
  })

  it("preserves an existing side API split panel mode", () => {
    const migrated = migrate({
      translate: {
        page: {
          splitPanelMode: "sideAPI",
        },
      },
    })

    expect(migrated.translate.page.splitPanelMode).toBe("sideAPI")
  })

  it("falls back to DOM for unknown split panel modes", () => {
    const migrated = migrate({
      translate: {
        page: {
          splitPanelMode: "native",
        },
      },
    })

    expect(migrated.translate.page.splitPanelMode).toBe("dom")
  })
})
