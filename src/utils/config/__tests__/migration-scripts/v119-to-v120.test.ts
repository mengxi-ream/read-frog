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
      ],
    }
    expect(migrate(odd)).toBe(odd)
  })
})
