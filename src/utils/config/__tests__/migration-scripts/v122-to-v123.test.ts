import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v122-to-v123"

/** Stored shapes, not the current schema — typed `any` like the migration they feed. */
function configWith(providersConfig: any[]): any {
  return { uiLanguage: "zh-CN", providersConfig }
}

const openai = {
  id: "openai-default",
  name: "OpenAI",
  enabled: true,
  provider: "openai",
  model: { model: "gpt-6-luna", isCustomModel: false, customModel: null },
}

const jalapeno = {
  id: "jalapenocloud-default",
  name: "Jalapeno Cloud",
  enabled: true,
  provider: "jalapenocloud",
  baseURL: "https://api.jalapeno-cloud.ai/v1",
  model: { model: "GLM-5.3", isCustomModel: false, customModel: null },
}

describe("v122 to v123 migration", () => {
  it("appends IF API after the providers the user already has", () => {
    const migrated = migrate(configWith([openai, jalapeno]))

    expect(migrated.providersConfig.map((provider: any) => provider.id)).toEqual([
      "openai-default",
      "jalapenocloud-default",
      "ifapi-default",
    ])
    expect(migrated.providersConfig.at(-1)).toEqual({
      id: "ifapi-default",
      name: "IF API",
      enabled: true,
      provider: "ifapi",
      description: "GPT, Claude, Gemini and more, from 10% of list price",
      baseURL: "https://cn.ifapi.org/v1",
      model: { model: "gpt-6-luna", isCustomModel: false, customModel: null },
      providerOptions: { reasoning_effort: "none" },
    })
    expect(migrated.uiLanguage).toBe("zh-CN")
  })

  it("seeds an empty provider list too", () => {
    expect(migrate(configWith([])).providersConfig.map((provider: any) => provider.id)).toEqual([
      "ifapi-default",
    ])
  })

  it("leaves the input untouched", () => {
    const config = configWith([openai])
    const before = structuredClone(config)

    migrate(config)

    expect(config).toEqual(before)
  })

  it("is idempotent", () => {
    const once = migrate(configWith([openai]))
    const twice = migrate(once)

    expect(twice).toBe(once)
    expect(
      twice.providersConfig.filter((provider: any) => provider.provider === "ifapi"),
    ).toHaveLength(1)
  })

  it("keeps an IF API provider the user already has, matched by type or by id", () => {
    const byType = configWith([openai, { ...openai, id: "my-ifapi", provider: "ifapi" }])
    const byId = configWith([{ ...openai, id: "ifapi-default" }])

    expect(migrate(byType)).toBe(byType)
    expect(migrate(byId)).toBe(byId)
  })

  it("returns non-config input untouched", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate({ providersConfig: "not an array" })).toEqual({
      providersConfig: "not an array",
    })
  })
})
