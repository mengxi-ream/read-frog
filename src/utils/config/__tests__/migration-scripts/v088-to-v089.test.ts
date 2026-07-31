import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v088-to-v089"

describe("v088-to-v089 migration", () => {
  it("adds disabled force retranslation to hover translation config", () => {
    const oldConfig = {
      translate: {
        providerId: "provider-1",
        node: {
          enabled: true,
          hotkey: "control",
        },
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      translate: {
        providerId: "provider-1",
        node: {
          enabled: true,
          hotkey: "control",
          forceRetranslation: false,
        },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("preserves an existing force retranslation value when rerun", () => {
    const oldConfig = {
      translate: {
        node: {
          enabled: false,
          hotkey: "alt",
          forceRetranslation: true,
        },
      },
    }

    expect(migrate(oldConfig)).toEqual(oldConfig)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ translate: null })).toEqual({ translate: null })
    expect(migrate({ translate: { node: null } })).toEqual({ translate: { node: null } })
  })
})
