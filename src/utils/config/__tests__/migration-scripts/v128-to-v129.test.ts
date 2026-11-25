import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v128-to-v129"

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
  ["openai", "gpt-4.1-nano", "gpt-5.6-luna"],
  ["openai", "gpt-5-chat-latest", "gpt-5.6-sol"],
  ["openai", "gpt-5.1-chat-latest", "gpt-5.6-sol"],
  ["openai", "gpt-5.2-chat-latest", "gpt-5.6-sol"],
  ["openai", "gpt-5.3-chat-latest", "gpt-5.6-sol"],
  ["openai", "gpt-5-codex", "gpt-5.6-sol"],
  ["openai", "gpt-5.1-codex", "gpt-5.6-sol"],
  ["openai", "gpt-5.1-codex-mini", "gpt-5.6-terra"],
  ["anthropic", "claude-opus-4-0", "claude-opus-4-8"],
  ["anthropic", "claude-opus-4-1", "claude-opus-4-8"],
  ["anthropic", "claude-sonnet-4-0", "claude-sonnet-5-5"],
  ["anthropic", "claude-sonnet-4-5", "claude-sonnet-5-5"],
  ["google", "gemini-3-pro-preview", "gemini-3.1-pro-preview"],
  ["google", "gemini-3.1-flash-lite-preview", "gemini-3.1-flash-lite"],
  ["google", "gemini-2.0-flash", "gemini-3.6-flash"],
  ["google", "gemini-3.1-flash-image-preview", "gemini-3.5-flash-lite"],
  ["google", "gemini-3-pro-image-preview", "gemini-3.5-flash-lite"],
  ["moonshotai", "moonshot-v1-8k", "kimi-k3"],
  ["moonshotai", "moonshot-v1-32k", "kimi-k3"],
  ["moonshotai", "moonshot-v1-128k", "kimi-k3"],
  ["moonshotai", "kimi-k2", "kimi-k3"],
  ["moonshotai", "kimi-k2.5", "kimi-k3"],
  ["moonshotai", "kimi-k2-thinking", "kimi-k3"],
  ["moonshotai", "kimi-k2-thinking-turbo", "kimi-k3"],
  ["moonshotai", "kimi-k2-turbo", "kimi-k3"],
  ["deepseek", "deepseek-v4-flash", "deepseek-flash"],
  ["groq", "gemma2-9b-it", "openai/gpt-oss-20b"],
  ["groq", "llama-3.1-8b-instant", "openai/gpt-oss-20b"],
  ["groq", "llama3-8b-8192", "openai/gpt-oss-20b"],
  ["groq", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  ["groq", "llama3-70b-8192", "openai/gpt-oss-120b"],
  ["groq", "deepseek-r1-distill-llama-70b", "openai/gpt-oss-120b"],
  ["groq", "deepseek-r1-distill-qwen-32b", "openai/gpt-oss-120b"],
  ["groq", "meta-llama/llama-4-maverick-17b-128e-instruct", "openai/gpt-oss-120b"],
  ["groq", "meta-llama/llama-4-scout-17b-16e-instruct", "openai/gpt-oss-120b"],
  ["groq", "moonshotai/kimi-k2-instruct-0905", "openai/gpt-oss-120b"],
  ["groq", "mixtral-8x7b-32768", "openai/gpt-oss-120b"],
  ["groq", "qwen/qwen3-32b", "openai/gpt-oss-120b"],
  ["groq", "qwen-qwq-32b", "openai/gpt-oss-120b"],
  ["groq", "qwen-2.5-32b", "openai/gpt-oss-120b"],
  ["groq", "qwen/qwen3.6-27b", "qwen/qwen3.8-27b"],
  ["cerebras", "gemma-4-31b", "gpt-oss-120b"],
  ["cerebras", "llama3.1-8b", "gpt-oss-120b"],
  ["cerebras", "llama-3.3-70b", "gpt-oss-120b"],
  ["cerebras", "qwen-3-32b", "gpt-oss-120b"],
  ["cerebras", "qwen-3-235b-a22b-instruct-2507", "gpt-oss-120b"],
  ["cerebras", "qwen-3-235b-a22b-thinking-2507", "gpt-oss-120b"],
  ["cerebras", "zai-glm-4.6", "gpt-oss-120b"],
  ["cerebras", "zai-glm-4.7", "gpt-oss-120b"],
  ["mistral", "zai-glm-5-2", "zai-glm-5-3"],
  ["mistral", "mistral-medium-2505", "mistral-medium-latest"],
  ["mistral", "mistral-medium-2508", "mistral-medium-latest"],
  ["mistral", "magistral-medium-2506", "mistral-medium-latest"],
  ["mistral", "magistral-medium-2507", "mistral-medium-latest"],
  ["mistral", "pixtral-large-latest", "mistral-medium-latest"],
  ["mistral", "magistral-small-2506", "mistral-small-latest"],
  ["mistral", "magistral-small-2507", "mistral-small-latest"],
  ["mistral", "open-mixtral-8x7b", "mistral-small-latest"],
  ["mistral", "open-mixtral-8x22b", "mistral-small-latest"],
  ["mistral", "pixtral-12b-2409", "ministral-14b-latest"],
  ["mistral", "open-mistral-7b", "ministral-8b-latest"],
]

describe("v128-to-v129 migration", () => {
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
      providersConfig: [provider("groq", "openai/gpt-oss-20b", true, "  Llama-3.3-70B-Versatile ")],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "openai/gpt-oss-120b",
      isCustomModel: false,
      customModel: null,
    })
  })

  it("rewrites the listed model but keeps a custom model the user typed", () => {
    const migrated = migrate({
      providersConfig: [provider("anthropic", "claude-sonnet-4-5", true, "my-claude-proxy")],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "claude-sonnet-5-5",
      isCustomModel: true,
      customModel: "my-claude-proxy",
    })
  })

  it("keeps a custom model that is still listed, and an inactive stale customModel", () => {
    const config = {
      providersConfig: [
        provider("moonshotai", "kimi-k2.6", true, "kimi-k2.6"),
        provider("groq", "openai/gpt-oss-20b", false, "llama-3.1-8b-instant"),
      ],
    }

    expect(migrate(config)).toBe(config)
  })

  it("leaves providers on models that are still listed untouched", () => {
    const kept = [
      provider("openai", "gpt-6-luna"),
      provider("openai", "gpt-5"),
      provider("anthropic", "claude-opus-4-5"),
      provider("google", "gemini-2.5-pro"),
      provider("google", "gemini-2.5-flash-lite-preview-06-17"),
      provider("moonshotai", "kimi-k2.6"),
      provider("deepseek", "deepseek-v4-pro"),
      provider("groq", "qwen/qwen3.8-27b"),
      provider("cerebras", "gpt-oss-120b"),
      provider("mistral", "mistral-medium-3.5"),
    ]
    const moved = provider("cerebras", "zai-glm-4.7")

    const migrated = migrate({ providersConfig: [...kept, moved] })

    expect(migrated.providersConfig.slice(0, kept.length)).toEqual(kept)
    expect(
      migrated.providersConfig
        .slice(0, kept.length)
        .every((p: unknown, i: number) => p === kept[i]),
    ).toBe(true)
    expect(migrated.providersConfig[kept.length].model.model).toBe("gpt-oss-120b")
  })

  it("only looks at the provider's own removed list", () => {
    // A removed id is only removed for the provider it was dropped from: Alibaba
    // still hosts kimi-k2.5, AtlasCloud still serves V4 Flash, and a custom
    // endpoint may still serve the others.
    const config = {
      providersConfig: [
        provider("alibaba", "kimi-k2.5"),
        provider("alibaba", "deepseek-v4-flash"),
        provider("atlascloud", "deepseek-ai/deepseek-v4-flash"),
        provider("deepinfra", "meta-llama/Llama-3.3-70B-Instruct"),
        provider("togetherai", "openai/gpt-oss-20b"),
        provider("openai-compatible", "gpt-5-chat-latest"),
      ],
    }

    expect(migrate(config)).toBe(config)
  })

  it("returns the config by identity when nothing moves, including on a second run", () => {
    const config = { providersConfig: [provider("moonshotai", "kimi-k3")], other: { a: 1 } }
    expect(migrate(config)).toBe(config)

    const once = migrate({ providersConfig: [provider("moonshotai", "kimi-k2.5")] })
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
        { provider: "groq" },
        { provider: "groq", model: "qwen/qwen3-32b" },
        provider("constructor", "gemma2-9b-it"),
        provider("groq", "toString"),
      ],
    }
    expect(migrate(odd)).toBe(odd)
  })
})
