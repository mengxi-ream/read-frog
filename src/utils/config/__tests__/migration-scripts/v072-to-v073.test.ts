import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v072-to-v073"

describe("v072-to-v073 migration", () => {
  it("converts removed selector-backed AI SDK models into custom model entries", () => {
    const migrated = migrate({
      providersConfig: [
        {
          id: "google-default",
          provider: "google",
          model: {
            model: "gemini-1.5-flash",
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
      customModel: "gemini-1.5-flash",
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

  it("preserves active custom model values when a stale selector field is migrated", () => {
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
      ],
    })

    expect(migrated.providersConfig[0].model).toEqual({
      model: "claude-haiku-4-5",
      isCustomModel: true,
      customModel: "custom-claude-alias",
    })
    expect(migrated.providersConfig[1].model).toEqual({
      model: "deepseek-chat",
      isCustomModel: true,
      customModel: "deepseek-v4-pro",
    })
  })
})
