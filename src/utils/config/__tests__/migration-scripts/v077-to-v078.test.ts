import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v077-to-v078"

describe("v077-to-v078 migration", () => {
  it("adds the default selection translation shortcut", () => {
    const migrated = migrate({
      selectionToolbar: {
        enabled: true,
        features: {
          translate: {
            enabled: true,
            providerId: "google-default",
          },
          speak: {
            enabled: true,
          },
        },
      },
    })

    expect(migrated.selectionToolbar.features.translate).toEqual({
      enabled: true,
      providerId: "google-default",
      shortcut: "Alt+T",
    })
    expect(migrated.selectionToolbar.features.speak).toEqual({
      enabled: true,
    })
  })

  it("is safe for configs without existing selection toolbar fields", () => {
    expect(migrate({})).toEqual({
      selectionToolbar: {
        features: {
          translate: {
            shortcut: "Alt+T",
          },
        },
      },
    })
  })
})
