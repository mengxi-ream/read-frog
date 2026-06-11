import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v077-to-v078"

describe("v077-to-v078 migration", () => {
  it("does not add translate config when translate is absent", () => {
    expect(migrate({})).toEqual({})
  })

  it("adds the side panel translation shortcut to translate page config", () => {
    const migrated = migrate({
      translate: {
        page: {
          shortcut: "Alt+B",
        },
      },
    })

    expect(migrated.translate.page.sidePanelShortcut).toBe("Alt+C")
  })

  it("preserves an existing side panel translation shortcut", () => {
    const migrated = migrate({
      translate: {
        page: {
          shortcut: "Alt+B",
          sidePanelShortcut: "Control+Shift+Y",
        },
      },
    })

    expect(migrated.translate.page.sidePanelShortcut).toBe("Control+Shift+Y")
  })

  it("adds translation hub selected providers", () => {
    const migrated = migrate({
      translate: {},
    })

    expect(migrated.translate.translationHub.selectedProviderIds).toEqual(["microsoft-translate-default"])
  })

  it("preserves existing translation hub selected providers", () => {
    const migrated = migrate({
      translate: {
        translationHub: {
          selectedProviderIds: ["google-translate-default", "microsoft-translate-default"],
        },
      },
    })

    expect(migrated.translate.translationHub.selectedProviderIds).toEqual([
      "google-translate-default",
      "microsoft-translate-default",
    ])
  })
})
