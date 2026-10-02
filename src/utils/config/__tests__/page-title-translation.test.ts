import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrateConfig } from "../migration"
import { migrate } from "../migration-scripts/v108-to-v109"

describe("page title translation config", () => {
  it("accepts pre-toggle settings without resetting the reader's other preferences", () => {
    const oldConfig = structuredClone(DEFAULT_CONFIG)
    Reflect.deleteProperty(oldConfig.pageTranslation.page, "translateTitle")
    oldConfig.pageTranslation.page.range = "main"

    const parsed = configSchema.parse(oldConfig)

    expect(parsed.pageTranslation.page.translateTitle).toBe(true)
    expect(parsed.pageTranslation.page.range).toBe("main")
  })

  it("preserves an explicit opt-out through schema parsing", () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.pageTranslation.page.translateTitle = false

    expect(configSchema.parse(config).pageTranslation.page.translateTitle).toBe(false)
  })

  it("migrates v108 settings with title translation enabled by default", async () => {
    const oldConfig = structuredClone(DEFAULT_CONFIG)
    Reflect.deleteProperty(oldConfig.pageTranslation.page, "translateTitle")

    const migrated = await migrateConfig(oldConfig, 108)

    expect(migrated.pageTranslation.page).toEqual({
      ...oldConfig.pageTranslation.page,
      translateTitle: true,
    })
    expect(oldConfig.pageTranslation.page).not.toHaveProperty("translateTitle")
  })

  it.each([true, false])(
    "keeps an explicit %s preference when the migration is rerun",
    (translateTitle) => {
      const config = structuredClone(DEFAULT_CONFIG)
      config.pageTranslation.page.translateTitle = translateTitle

      const migrated = migrate(config)

      expect(migrated).toEqual(config)
      expect(migrate(migrated)).toEqual(migrated)
    },
  )
})
