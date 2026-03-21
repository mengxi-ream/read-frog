import type { PartialDeep } from "type-fest"
import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { updateLLMProviderConfig, updateProviderConfig } from "../provider"

type OpenAIProviderConfig = Extract<ProviderConfig, { provider: "openai" }>

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
      connectionOptions: {
        timeoutMs: 5000,
      },
      providerOptions: {
        reasoningEffort: "minimal",
      },
    }) as OpenAIProviderConfig

    expect(result.connectionOptions).toEqual({ timeoutMs: 5000 })
    expect(result.providerOptions).toEqual({ reasoningEffort: "minimal" })
    expect(result.model).toEqual(DEFAULT_PROVIDER_CONFIG.openai.model)
    expect(result.provider).toBe("openai")
  })

  it("rejects merged configs that no longer match the provider schema", () => {
    const invalidUpdates = {
      provider: "openai",
    } as PartialDeep<ProviderConfig>

    expect(() => updateProviderConfig(DEFAULT_PROVIDER_CONFIG["google-translate"], invalidUpdates)).toThrow()
  })
})
