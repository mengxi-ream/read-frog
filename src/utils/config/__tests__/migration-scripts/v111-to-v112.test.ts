import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v111-to-v112"

describe("v111-to-v112 migration", () => {
  it("adds the custom paragraph shortcut without changing the chosen hotkey", () => {
    const oldConfig = {
      pageTranslation: {
        providerId: "provider-1",
        node: {
          enabled: true,
          hotkey: "shift",
          forceRetranslation: false,
        },
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      pageTranslation: {
        providerId: "provider-1",
        node: {
          enabled: true,
          hotkey: "shift",
          shortcut: "Alt+Q",
          forceRetranslation: false,
        },
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a shortcut that is already there when rerun", () => {
    const oldConfig = { pageTranslation: { node: { hotkey: "custom", shortcut: "Control+Q" } } }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("gives a config that the v112 schema accepts with the custom hotkey", () => {
    const { shortcut: _shortcut, ...node } = DEFAULT_CONFIG.pageTranslation.node
    const config = {
      ...DEFAULT_CONFIG,
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, node },
    }

    const migrated = migrate(structuredClone(config))
    const parsed = configSchema.safeParse({
      ...migrated,
      pageTranslation: {
        ...migrated.pageTranslation,
        node: { ...migrated.pageTranslation.node, hotkey: "custom" },
      },
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.pageTranslation.node).toMatchObject({
      hotkey: "custom",
      shortcut: "Alt+Q",
    })
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ pageTranslation: null })).toEqual({ pageTranslation: null })
    expect(migrate({ pageTranslation: { node: [] } })).toEqual({ pageTranslation: { node: [] } })
  })
})
