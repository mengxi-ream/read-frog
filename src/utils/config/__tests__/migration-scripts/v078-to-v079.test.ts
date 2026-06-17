import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v078-to-v079"

describe("v078-to-v079 migration", () => {
  it("converts removed selector-backed AI SDK models into custom model entries", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "google-default",
          provider: "google",
          model: {
            model: "gemini-3.1-flash-lite",
            isCustomModel: false,
            customModel: "stale-dormant-custom-value",
          },
        },
        {
          id: "xai-default",
          provider: "xai",
          model: {
            model: "grok-3-fast",
            isCustomModel: false,
            customModel: null,
          },
        },
        {
          id: "groq-default",
          provider: "groq",
          model: {
            model: "meta-llama/llama-prompt-guard-2-86m",
            isCustomModel: false,
            customModel: null,
          },
        },
        {
          id: "openai-default",
          provider: "openai",
          model: {
            model: "gpt-5-mini",
            isCustomModel: false,
            customModel: null,
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "gemini-2.5-flash-lite",
      isCustomModel: true,
      customModel: "gemini-3.1-flash-lite",
    })
    expect(migrated.providersConfig[1].model).toEqual({
      model: "grok-3",
      isCustomModel: true,
      customModel: "grok-3-fast",
    })
    expect(migrated.providersConfig[2].model).toEqual({
      model: "llama-3.1-8b-instant",
      isCustomModel: true,
      customModel: "meta-llama/llama-prompt-guard-2-86m",
    })
    expect(migrated.providersConfig[3].model).toEqual({
      model: "gpt-5-mini",
      isCustomModel: false,
      customModel: null,
    })
  })

  it("preserves active custom values and leaves retained DeepSeek models untouched", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "anthropic-default",
          provider: "anthropic",
          model: {
            model: "claude-3-7-sonnet-latest",
            isCustomModel: true,
            customModel: "custom-claude-alias",
          },
        },
        {
          id: "deepseek-default",
          provider: "deepseek",
          model: {
            model: "deepseek-v4-pro",
            isCustomModel: true,
            customModel: "   ",
          },
        },
        {
          id: "bedrock-default",
          provider: "bedrock",
          model: {
            model: "anthropic.claude-3-5-haiku-20241022-v1:0",
            isCustomModel: false,
            customModel: "unused-bedrock-alias",
          },
        },
      ],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "claude-haiku-4-5",
      isCustomModel: true,
      customModel: "custom-claude-alias",
    })
    expect(migrated.providersConfig[1].model).toEqual({
      model: "deepseek-v4-pro",
      isCustomModel: true,
      customModel: "   ",
    })
    expect(migrated.providersConfig[2].model).toEqual({
      model: "us.amazon.nova-micro-v1:0",
      isCustomModel: true,
      customModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
    })
  })
})
