import { describe, expect, it } from "vitest"
import { providerConfigItemSchema } from "@/types/config/provider"
import { migrate } from "../../migration-scripts/v109-to-v110"

describe("v109-to-v110", () => {
  it("adds a valid free provider without changing selections or mutating the old config", () => {
    const old = {
      providersConfig: [{ id: "existing", provider: "google-translate" }],
      pageTranslation: { providerId: "existing" },
    }
    const snapshot = structuredClone(old)
    const migrated = migrate(old)
    expect(old).toEqual(snapshot)
    expect(migrated.pageTranslation).toEqual(old.pageTranslation)
    expect(migrated.providersConfig[0]).toEqual(old.providersConfig[0])
    expect(providerConfigItemSchema.safeParse(migrated.providersConfig[1]).success).toBe(true)
    expect(migrate(migrated)).toBe(migrated)
  })
  it("preserves an existing disabled Bilibili provider", () => {
    const config = { providersConfig: [{ provider: "bilibili-translate", enabled: false }] }
    expect(migrate(config)).toBe(config)
  })
  it("avoids colliding with a user-created provider id", () => {
    const migrated = migrate({
      providersConfig: [{ id: "bilibili-translate-default", provider: "openai" }],
    })
    expect(migrated.providersConfig[1].id).toBe("bilibili-translate-default-new")
  })
})
