import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v132-to-v133"

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

const MOVES: Array<[provider: string, removed: string, replacement: string]> = [
  ["google", "gemini-2.5-pro", "gemini-3.8-flash"],
  ["google", "gemini-2.5-flash", "gemini-3.5-flash-lite"],
  ["deepseek", "deepseek-v4-flash", "deepseek-flash"],
]

describe("v132-to-v133 migration", () => {
  it.each(MOVES)("moves %s off the removed %s onto %s", (type, removed, replacement) => {
    const oldConfig = { providersConfig: [provider(type, removed)] }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.providersConfig).toEqual([provider(type, replacement)])
    expect(oldConfig).toEqual(snapshot)
  })

  // Ticking "enter custom model" copies the selected id into customModel, and requests
  // go to customModel, so a removed id parked there must not survive the migration.
  it.each(MOVES)(
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
      providersConfig: [provider("google", "gemini-3.5-flash-lite", true, "  Gemini-2.5-Pro ")],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "gemini-3.8-flash",
      isCustomModel: false,
      customModel: null,
    })
  })

  it("rewrites the listed model but keeps a custom model the user typed", () => {
    const migrated = migrate({
      providersConfig: [provider("google", "gemini-2.5-flash", true, "my-gemini-proxy")],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "gemini-3.5-flash-lite",
      isCustomModel: true,
      customModel: "my-gemini-proxy",
    })
  })

  it("leaves providers on models that are still listed untouched", () => {
    const kept = [
      provider("google", "gemini-2.5-flash-lite"),
      provider("google", "gemini-2.5-flash-lite-preview-06-17"),
      provider("google", "gemini-3.5-flash-lite"),
      provider("deepseek", "deepseek-flash"),
      provider("deepseek", "deepseek-v4-pro"),
      provider("openai", "gpt-5"),
      // An inactive stale customModel is not a request target.
      provider("google", "gemini-3.8-flash", false, "gemini-2.5-pro"),
    ]
    const moved = provider("google", "gemini-2.5-pro")

    const migrated = migrate({ providersConfig: [...kept, moved] })

    expect(migrated.providersConfig.slice(0, kept.length)).toEqual(kept)
    expect(
      migrated.providersConfig
        .slice(0, kept.length)
        .every((p: unknown, i: number) => p === kept[i]),
    ).toBe(true)
    expect(migrated.providersConfig[kept.length].model.model).toBe("gemini-3.8-flash")
  })

  it("only looks at the provider's own removed list", () => {
    // The ids are only removed for the provider they were dropped from: other hosts
    // still serve DeepSeek V4 Flash, and a custom endpoint may still serve Gemini 2.5.
    const config = {
      providersConfig: [
        provider("alibaba", "deepseek-v4-flash"),
        provider("atlascloud", "deepseek-ai/deepseek-v4-flash"),
        provider("openrouter", "deepseek/deepseek-v4-flash"),
        provider("openai-compatible", "gemini-2.5-pro"),
        provider("deepseek", "gemini-2.5-pro"),
      ],
    }

    expect(migrate(config)).toBe(config)
  })

  it("returns the config by identity when nothing moves, including on a second run", () => {
    const config = { providersConfig: [provider("google", "gemini-3.8-flash")], other: { a: 1 } }
    expect(migrate(config)).toBe(config)

    const once = migrate({ providersConfig: [provider("google", "gemini-2.5-pro")] })
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
        { provider: "google" },
        { provider: "google", model: "gemini-2.5-pro" },
        provider("constructor", "gemini-2.5-pro"),
        provider("google", "toString"),
      ],
    }
    expect(migrate(odd)).toBe(odd)
  })
})
