import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v081-to-v082"

describe("v081-to-v082 migration", () => {
  it("adds OpenAI-compatible default base URLs for OpenRouter and MiniMax", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openrouter-default",
          provider: "openrouter",
          apiKey: "openrouter-key",
          model: {
            model: "x-ai/grok-4-fast:free",
            isCustomModel: false,
            customModel: null,
          },
        },
        {
          id: "minimax-default",
          provider: "minimax",
          baseURL: "https://api.minimaxi.com/anthropic/v1",
          apiKey: "minimax-key",
          model: {
            model: "MiniMax-M2.7",
            isCustomModel: false,
            customModel: null,
          },
        },
      ],
    })

    expect(migrated.providersConfig[0]).toEqual(expect.objectContaining({
      provider: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "openrouter-key",
    }))
    expect(migrated.providersConfig[1]).toEqual(expect.objectContaining({
      provider: "minimax",
      baseURL: "https://api.minimax.io/v1",
      apiKey: "minimax-key",
    }))
  })

  it("preserves custom base URLs", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openrouter-proxy",
          provider: "openrouter",
          baseURL: "https://proxy.example.test/openrouter/v1",
        },
        {
          id: "minimax-proxy",
          provider: "minimax",
          baseURL: "https://proxy.example.test/minimax/v1",
        },
      ],
    })

    expect(migrated.providersConfig[0].baseURL).toBe("https://proxy.example.test/openrouter/v1")
    expect(migrated.providersConfig[1].baseURL).toBe("https://proxy.example.test/minimax/v1")
  })

  it("moves simple reasoning effort provider options to top-level reasoning", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openai-default",
          provider: "openai",
          providerOptions: { reasoningEffort: "minimal" },
        },
        {
          id: "groq-default",
          provider: "groq",
          providerOptions: { reasoning_effort: "none" },
        },
      ],
    })

    expect(migrated.providersConfig[0]).toEqual({
      id: "openai-default",
      provider: "openai",
      reasoning: "minimal",
    })
    expect(migrated.providersConfig[1]).toEqual({
      id: "groq-default",
      provider: "groq",
      reasoning: "none",
    })
  })

  it("defaults missing reasoning to none for top-level reasoning providers without provider options", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openai-default",
          provider: "openai",
        },
        {
          id: "anthropic-default",
          provider: "anthropic",
          reasoning: "provider-default",
        },
        {
          id: "azure-default",
          provider: "azure",
        },
        {
          id: "openrouter-default",
          provider: "openrouter",
        },
      ],
    })

    expect(migrated.providersConfig[0].reasoning).toBe("none")
    expect(migrated.providersConfig[1].reasoning).toBe("provider-default")
    expect(migrated.providersConfig[2].reasoning).toBeUndefined()
    expect(migrated.providersConfig[3].reasoning).toBeUndefined()
  })

  it("keeps complex or provider-specific provider options unchanged", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "openai-complex",
          provider: "openai",
          providerOptions: {
            reasoningEffort: "minimal",
            textVerbosity: "low",
          },
        },
        {
          id: "groq-format",
          provider: "groq",
          providerOptions: {
            reasoningFormat: "parsed",
          },
        },
        {
          id: "openrouter-compatible",
          provider: "openrouter",
          providerOptions: {
            reasoningEffort: "low",
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].providerOptions).toEqual({
      reasoningEffort: "minimal",
      textVerbosity: "low",
    })
    expect(migrated.providersConfig[0].reasoning).toBeUndefined()
    expect(migrated.providersConfig[1].providerOptions).toEqual({
      reasoningFormat: "parsed",
    })
    expect(migrated.providersConfig[1].reasoning).toBeUndefined()
    expect(migrated.providersConfig[2].providerOptions).toEqual({
      reasoningEffort: "low",
    })
    expect(migrated.providersConfig[2].reasoning).toBeUndefined()
  })
})
