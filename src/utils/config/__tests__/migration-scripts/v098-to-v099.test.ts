import { describe, expect, it } from "vitest"
import { API_PROVIDER_TYPES } from "@/types/config/provider"
import { migrate } from "../../migration-scripts/v098-to-v099"

/**
 * The shape v097-to-v098 seeded for existing users: a frozen literal with no description.
 * Typed `any` like the migration it feeds — these are stored shapes, not the current schema.
 */
function configWithSeededJalapeno(): any {
  return {
    uiLanguage: "zh-CN",
    providersConfig: [
      {
        id: "jalapenocloud-default",
        name: "Jalapeno Cloud",
        enabled: true,
        provider: "jalapenocloud",
        baseURL: "https://api.jalapeno-cloud.ai/v1",
      },
      {
        id: "microsoft-translate-default",
        enabled: true,
        provider: "microsoft-translate",
      },
    ],
  }
}

describe("v098 to v099 migration", () => {
  it("fills in the description a migration-seeded provider never got", () => {
    const migrated = migrate(configWithSeededJalapeno())

    expect(migrated.providersConfig[0].description).toBe(
      "Enterprise-grade AI used by top teams — now made for you!",
    )
  })

  it("keeps every other field of the provider it fills", () => {
    const migrated = migrate(configWithSeededJalapeno())

    expect(migrated.providersConfig[0]).toEqual({
      ...configWithSeededJalapeno().providersConfig[0],
      description: expect.any(String),
    })
  })

  it("leaves providers whose type has no description alone", () => {
    const migrated = migrate(configWithSeededJalapeno())

    expect(migrated.providersConfig[1]).not.toHaveProperty("description")
  })

  it("does not overwrite a description the user wrote", () => {
    const config = configWithSeededJalapeno()
    config.providersConfig[0].description = "my own wording"

    expect(migrate(config).providersConfig[0].description).toBe("my own wording")
  })

  it("treats an emptied description as one to fill", () => {
    const config = configWithSeededJalapeno()
    config.providersConfig[0].description = ""

    expect(migrate(config).providersConfig[0].description).toBe(
      "Enterprise-grade AI used by top teams — now made for you!",
    )
  })

  it("is idempotent and returns the config by identity when nothing needs filling", () => {
    const once = migrate(configWithSeededJalapeno())
    const twice = migrate(once)

    expect(twice).toEqual(once)
    expect(twice).toBe(once)
  })

  it("covers every API provider type, so no type can be seeded without a description", () => {
    const config = {
      providersConfig: API_PROVIDER_TYPES.map((provider, index) => ({
        id: `p${index}`,
        name: provider,
        enabled: true,
        provider,
      })),
    }

    const migrated = migrate(config)

    for (const providerConfig of migrated.providersConfig) {
      expect(providerConfig.description).toEqual(expect.any(String))
      expect(providerConfig.description.length).toBeGreaterThan(0)
    }
  })

  it("returns non-config input untouched", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate({ providersConfig: "not an array" })).toEqual({
      providersConfig: "not an array",
    })
  })
})
