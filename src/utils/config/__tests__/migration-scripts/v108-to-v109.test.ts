import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v108-to-v109"

describe("v108-to-v109 migration", () => {
  it("turns tab title translation on, as page translation always did", () => {
    const oldConfig = {
      pageTranslation: {
        providerId: "provider-1",
        page: {
          range: "main",
          skipLanguages: ["jpn"],
        },
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      pageTranslation: {
        providerId: "provider-1",
        page: {
          range: "main",
          skipLanguages: ["jpn"],
          translateTitle: true,
        },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a switch the reader already turned off when rerun", () => {
    const oldConfig = {
      pageTranslation: {
        page: {
          range: "all",
          translateTitle: false,
        },
      },
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ pageTranslation: null })).toEqual({ pageTranslation: null })
    expect(migrate({ pageTranslation: { page: [] } })).toEqual({ pageTranslation: { page: [] } })
  })
})
