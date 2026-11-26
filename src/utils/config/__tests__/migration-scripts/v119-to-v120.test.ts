import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v119-to-v120"

function provider(
  type: string,
  model: string,
  isCustomModel = false,
  customModel = null as string | null,
) {
  return {
    id: `${type}-default`,
    name: type,
    enabled: true,
    provider: type,
    model: { model, isCustomModel, customModel },
  }
}

describe("v119-to-v120 migration", () => {
  it.each([
    ["jalapenocloud", "GLM-5.2", "GLM-5.3"],
    ["jalapenocloud", "Hy3", "GLM-5.3"],
    ["jalapenocloud", "Qwen3-Next-80B-A3B-Instruct", "GLM-5.3"],
    ["deepseek", "deepseek-chat", "deepseek-v4-flash"],
    ["deepseek", "deepseek-reasoner", "deepseek-v4-flash"],
  ])("moves %s off the removed %s onto %s", (type, removed, replacement) => {
    const oldConfig = { providersConfig: [provider(type, removed)] }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig).toEqual([provider(type, replacement)])
    expect(oldConfig).toEqual(snapshot)
  })

  it("rewrites the listed model but keeps a custom model the user typed", () => {
    const migrated = migrate({
      providersConfig: [provider("jalapenocloud", "GLM-5.2", true, "my-glm-endpoint")],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "GLM-5.3",
      isCustomModel: true,
      customModel: "my-glm-endpoint",
    })
  })

  // Ticking "enter custom model" copies the selected id into customModel, and requests
  // go to customModel, so a removed id parked there must not survive the migration.
  it.each([
    ["jalapenocloud", "Hy3", "GLM-5.3"],
    ["jalapenocloud", "Qwen3-Next-80B-A3B-Instruct", "GLM-5.3"],
    ["jalapenocloud", "GLM-5.2", "GLM-5.3"],
    ["deepseek", "deepseek-chat", "deepseek-v4-flash"],
    ["deepseek", "deepseek-reasoner", "deepseek-v4-flash"],
  ])(
    "moves %s off a custom model prefilled with the removed %s, back onto %s",
    (type, removed, replacement) => {
      const migrated = migrate({ providersConfig: [provider(type, removed, true, removed)] })

      expect(migrated.providersConfig[0].model).toEqual({
        model: replacement,
        isCustomModel: false,
        customModel: null,
      })
    },
  )

  it("matches a removed custom model however the user typed it", () => {
    const migrated = migrate({
      providersConfig: [provider("deepseek", "deepseek-v4-pro", true, "  DeepSeek-Chat ")],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "deepseek-v4-flash",
      isCustomModel: false,
      customModel: null,
    })
  })

  it("keeps a custom model that is still listed, and an inactive stale customModel", () => {
    const config = {
      providersConfig: [
        provider("jalapenocloud", "GLM-5.1", true, "GLM-5.1"),
        provider("deepseek", "deepseek-v4-flash", false, "deepseek-chat"),
      ],
    }

    expect(migrate(config)).toBe(config)
  })

  it("leaves providers on models that are still listed untouched", () => {
    const kept = [
      provider("jalapenocloud", "GLM-5.1"),
      provider("jalapenocloud", "DeepSeek-V4-Flash"),
      provider("deepseek", "deepseek-v4-pro"),
    ]
    const moved = provider("deepseek", "deepseek-chat")

    const migrated = migrate({ providersConfig: [...kept, moved] })

    expect(migrated.providersConfig.slice(0, 3)).toEqual(kept)
    expect(
      migrated.providersConfig.slice(0, 3).every((p: unknown, i: number) => p === kept[i]),
    ).toBe(true)
    expect(migrated.providersConfig[3].model.model).toBe("deepseek-v4-flash")
  })

  it("only looks at the provider's own removed list", () => {
    // A removed id is only removed for the provider it was dropped from.
    const config = {
      providersConfig: [
        provider("siliconflow", "Qwen3-Next-80B-A3B-Instruct"),
        provider("openai", "GLM-5.2"),
      ],
    }

    expect(migrate(config)).toBe(config)
  })

  it("returns the config by identity when nothing moves, including on a second run", () => {
    const config = { providersConfig: [provider("jalapenocloud", "GLM-5.3")], other: { a: 1 } }
    expect(migrate(config)).toBe(config)

    const once = migrate({ providersConfig: [provider("jalapenocloud", "Hy3")] })
    expect(migrate(once)).toBe(once)
  })

  it("leaves malformed shapes for the schema parse", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate("x")).toBe("x")

    const noProviders = { language: {} }
    expect(migrate(noProviders)).toBe(noProviders)

    const odd = {
      providersConfig: [
        null,
        "x",
        { provider: "deepseek" },
        { provider: "deepseek", model: "deepseek-chat" },
        provider("constructor", "deepseek-chat"),
      ],
    }
    expect(migrate(odd)).toBe(odd)
  })
})
