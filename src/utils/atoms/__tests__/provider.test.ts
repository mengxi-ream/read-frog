import type { PartialDeep } from "type-fest"
import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { updateLLMProviderConfig, updateProviderConfig } from "../provider"

type OpenAIProviderConfig = Extract<ProviderConfig, { provider: "openai" }>
type BedrockProviderConfig = Extract<ProviderConfig, { provider: "bedrock" }>

describe("provider config updates", () => {
  it("merges nested LLM model updates without changing untouched fields", () => {
    const result = updateLLMProviderConfig(DEFAULT_PROVIDER_CONFIG.openai, {
      model: {
        customModel: "gpt-5-custom",
        isCustomModel: true,
      },
    })

    expect(result.model).toEqual({
      ...DEFAULT_PROVIDER_CONFIG.openai.model,
      customModel: "gpt-5-custom",
      isCustomModel: true,
    })
    expect(result.provider).toBe("openai")
  })

  it("merges provider option objects and preserves the rest of the config", () => {
    const result = updateProviderConfig(DEFAULT_PROVIDER_CONFIG.openai, {
      providerOptions: {
        reasoningEffort: "minimal",
      },
    }) as OpenAIProviderConfig

    expect(result.providerOptions).toEqual({ reasoningEffort: "minimal" })
    expect(result.model).toEqual(DEFAULT_PROVIDER_CONFIG.openai.model)
    expect(result.provider).toBe("openai")
  })

  it("merges provider headers and preserves the rest of the config", () => {
    const result = updateProviderConfig(DEFAULT_PROVIDER_CONFIG.openai, {
      headers: {
        "X-Test": "1",
      },
    }) as OpenAIProviderConfig

    expect(result.headers).toEqual({ "X-Test": "1" })
    expect(result.model).toEqual(DEFAULT_PROVIDER_CONFIG.openai.model)
    expect(result.provider).toBe("openai")
  })

  it("merges provider-specific settings for providers that define them", () => {
    const result = updateProviderConfig(DEFAULT_PROVIDER_CONFIG.bedrock, {
      providerSpecificSettings: {
        region: "us-west-2",
      },
    }) as BedrockProviderConfig

    expect(result.providerSpecificSettings).toEqual({ region: "us-west-2" })
    expect(result.model).toEqual(DEFAULT_PROVIDER_CONFIG.bedrock.model)
    expect(result.provider).toBe("bedrock")
  })

  it("rejects merged configs that no longer match the provider schema", () => {
    const invalidUpdates = {
      provider: "openai",
    } as PartialDeep<ProviderConfig>

    expect(() => updateProviderConfig(DEFAULT_PROVIDER_CONFIG["google-translate"], invalidUpdates)).toThrow()
  })
})
