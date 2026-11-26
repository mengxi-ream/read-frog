import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrateConfig } from "../../migration"
import { migrate } from "../../migration-scripts/v127-to-v128"
import { testSeries as v127TestSeries } from "../example/v127"

describe("v127-to-v128 migration", () => {
  it("opens the toolbar on the side the drag ended on, as it always has", () => {
    const oldConfig = {
      selectionToolbar: { enabled: true, opacity: 80 },
      floatingButton: { enabled: true },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      selectionToolbar: { enabled: true, opacity: 80, placement: "followDirection" },
      floatingButton: { enabled: true },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a placement already there and replaces one it doesn't know", () => {
    const pinned = { selectionToolbar: { enabled: true, placement: "above" } }
    expect(migrate(pinned)).toBe(pinned)

    expect(migrate({ selectionToolbar: { placement: "sideways" } })).toEqual({
      selectionToolbar: { placement: "followDirection" },
    })
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ selectionToolbar: null })).toEqual({ selectionToolbar: null })
    expect(migrate({ selectionToolbar: [] })).toEqual({ selectionToolbar: [] })
  })

  it("produces a valid current config from every v127 series", async () => {
    for (const series of Object.values(v127TestSeries)) {
      const migrated = await migrateConfig(structuredClone(series.config), 127)
      expect(configSchema.safeParse(migrated).success).toBe(true)
      expect(migrated.selectionToolbar.placement).toBe("followDirection")
    }
  })
})
