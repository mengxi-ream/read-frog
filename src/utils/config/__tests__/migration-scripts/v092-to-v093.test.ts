import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrate } from "../../migration-scripts/v092-to-v093"
import { testSeries as v092TestSeries } from "../example/v092"

function providerEntry(id: string, provider: string, enabled = true) {
  return { id, enabled, name: id, provider }
}

describe("v092-to-v093 migration", () => {
  it("moves a translationOnly Microsoft assignment to the default Google provider", () => {
    const oldConfig = {
      translate: { mode: "translationOnly", providerId: "microsoft-translate-default" },
      providersConfig: [
        providerEntry("microsoft-translate-default", "microsoft-translate"),
        providerEntry("google-translate-default", "google-translate"),
      ],
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.translate).toEqual({
      mode: "translationOnly",
      providerId: "google-translate-default",
    })
    expect(migrated.providersConfig).toEqual(oldConfig.providersConfig)
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("prefers the default Google entry but accepts any enabled one", () => {
    const oldConfig = {
      translate: { mode: "translationOnly", providerId: "ms-custom" },
      providersConfig: [
        providerEntry("ms-custom", "microsoft-translate"),
        providerEntry("google-disabled", "google-translate", false),
        providerEntry("google-custom", "google-translate"),
      ],
    }

    expect(migrate(oldConfig).translate.providerId).toBe("google-custom")
  })

  it("falls back to bilingual mode when no enabled Google provider exists", () => {
    const oldConfig = {
      translate: { mode: "translationOnly", providerId: "microsoft-translate-default" },
      providersConfig: [
        providerEntry("microsoft-translate-default", "microsoft-translate"),
        providerEntry("google-disabled", "google-translate", false),
      ],
    }

    const migrated = migrate(oldConfig)

    expect(migrated.translate).toEqual({
      mode: "bilingual",
      providerId: "microsoft-translate-default",
    })
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("leaves bilingual Microsoft assignments unchanged", () => {
    const oldConfig = {
      translate: { mode: "bilingual", providerId: "microsoft-translate-default" },
      providersConfig: [
        providerEntry("microsoft-translate-default", "microsoft-translate"),
        providerEntry("google-translate-default", "google-translate"),
      ],
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("leaves translationOnly non-Microsoft assignments unchanged", () => {
    const oldConfig = {
      translate: { mode: "translationOnly", providerId: "google-translate-default" },
      providersConfig: [
        providerEntry("microsoft-translate-default", "microsoft-translate"),
        providerEntry("google-translate-default", "google-translate"),
      ],
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })

  it("leaves malformed and unrelated shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ translate: null })).toEqual({ translate: null })
    expect(migrate({ translate: { mode: "translationOnly", providerId: "missing" } })).toEqual({
      translate: { mode: "translationOnly", providerId: "missing" },
    })
  })

  it.each(Object.entries(v092TestSeries))(
    "keeps the full %s fixture schema-valid",
    (_seriesId, series) => {
      const migrated = migrate(series.config)
      const parseResult = configSchema.safeParse(migrated)

      expect(parseResult.success).toBe(true)
    },
  )

  it("rewrites a full fixture config that pairs translationOnly with Microsoft", () => {
    const baseConfig: any = structuredClone(v092TestSeries["complex-config-from-v020"]!.config)
    baseConfig.translate.mode = "translationOnly"
    baseConfig.translate.providerId = "microsoft-translate-default"

    const migrated = migrate(baseConfig)

    expect(migrated.translate.mode).toBe("translationOnly")
    expect(migrated.translate.providerId).toBe("google-translate-default")
    expect(configSchema.safeParse(migrated).success).toBe(true)
  })
})
