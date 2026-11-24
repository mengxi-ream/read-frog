import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrateConfig } from "../../migration"
import { migrate } from "../../migration-scripts/v129-to-v130"
import { testSeries as v129TestSeries } from "../example/v129"

describe("v129-to-v130 migration", () => {
  it("adds simple mode's switches, all on", () => {
    const oldConfig = {
      pageTranslation: { mode: "bilingual" },
      videoSubtitles: { aiSegmentation: false },
      translationHub: { shortcut: "Alt+Shift+H" },
      contextMenu: { enabled: false },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      pageTranslation: { enabled: true, mode: "bilingual" },
      videoSubtitles: { enabled: true, aiSegmentation: false },
      translationHub: { enabled: true, shortcut: "Alt+Shift+H" },
      contextMenu: { enabled: false },
      customActions: { enabled: true },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a switch already there and replaces one that isn't a boolean", () => {
    const off = {
      pageTranslation: { enabled: false },
      videoSubtitles: { enabled: false },
      translationHub: { enabled: false },
      customActions: { enabled: false },
    }
    expect(migrate(off)).toBe(off)

    expect(
      migrate({
        pageTranslation: { enabled: "no" },
        customActions: { enabled: null, note: 1 },
      }),
    ).toEqual({
      pageTranslation: { enabled: true },
      customActions: { enabled: true, note: 1 },
    })
  })

  it("leaves missing and malformed sections for the schema parse", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({ pageTranslation: null, videoSubtitles: [] })).toEqual({
      pageTranslation: null,
      videoSubtitles: [],
      customActions: { enabled: true },
    })
    expect(migrate({ customActions: [] })).toEqual({ customActions: { enabled: true } })
  })

  it("produces a valid current config from every v129 series", async () => {
    for (const series of Object.values(v129TestSeries)) {
      const migrated = await migrateConfig(structuredClone(series.config), 129)
      expect(configSchema.safeParse(migrated).success).toBe(true)
      expect(migrated.pageTranslation.enabled).toBe(true)
      expect(migrated.videoSubtitles.enabled).toBe(true)
      expect(migrated.translationHub.enabled).toBe(true)
      expect(migrated.customActions).toEqual({ enabled: true })
    }
  })
})
