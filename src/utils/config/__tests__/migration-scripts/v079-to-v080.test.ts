import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v079-to-v080"

describe("v079-to-v080 migration", () => {
  it("adds customShortcut: '' when missing", () => {
    const migrated = migrate({
      translate: {
        node: {
          enabled: true,
          hotkey: "alt",
        },
      },
    })

    expect(migrated.translate.node).toEqual({
      enabled: true,
      hotkey: "alt",
      customShortcut: "",
    })
  })

  it("preserves existing customShortcut", () => {
    const migrated = migrate({
      translate: {
        node: {
          enabled: true,
          hotkey: "custom",
          customShortcut: "Alt+T",
        },
      },
    })

    expect(migrated.translate.node.customShortcut).toBe("Alt+T")
  })

  it("is idempotent", () => {
    const config = { translate: { node: { enabled: true, hotkey: "control", customShortcut: "" } } }
    expect(migrate(config)).toEqual(config)
  })

  it("handles missing translate/node gracefully", () => {
    const migrated = migrate({})

    expect(migrated.translate.node.customShortcut).toBe("")
  })
})
