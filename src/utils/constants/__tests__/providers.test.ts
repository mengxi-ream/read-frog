import { describe, expect, it } from "vitest"
import { API_PROVIDER_TYPES, apiProviderConfigItemSchema, CUSTOM_LLM_PROVIDER_TYPES, NON_CUSTOM_LLM_PROVIDER_TYPES, TOP_LEVEL_REASONING_PROVIDER_TYPES } from "@/types/config/provider"
import { DEFAULT_PROVIDER_CONFIG, PROVIDER_BASE_URL_PLACEHOLDERS, PROVIDER_ITEMS } from "../providers"

describe("provider constants", () => {
  it("defines Azure with the LobeHub color icon and GPT shortcut defaults", () => {
    expect(PROVIDER_ITEMS.azure.logo("light")).toContain("/light/azure-color.webp")
    expect(PROVIDER_ITEMS.azure.logo("dark")).toContain("/dark/azure-color.webp")

    expect(DEFAULT_PROVIDER_CONFIG.azure).toEqual(expect.objectContaining({
      id: "azure-default",
      name: "Azure",
      provider: "azure",
      model: {
        model: "gpt-5.4-mini",
        isCustomModel: false,
        customModel: null,
      },
      providerSpecificSettings: {
        apiMode: "responses",
        apiVersion: "v1",
      },
    }))
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.azure)).toEqual(DEFAULT_PROVIDER_CONFIG.azure)
  })

  it("defines provider-specific Base URL placeholders", () => {
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.atlascloud).toBe("https://api.atlascloud.ai/v1")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.azure).toBe("https://<resource>.services.ai.azure.com/openai")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.openai).toBe("https://api.openai.com/v1")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS["openai-compatible"]).toBe("https://api.example.com/v1")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.openrouter).toBe("https://openrouter.ai/api/v1")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.ollama).toBe("http://127.0.0.1:11434/")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.minimax).toBe("https://api.minimax.io/v1")
  })

  it("defines Ollama without injecting the root URL into the default config", () => {
    expect(DEFAULT_PROVIDER_CONFIG.ollama).toEqual(expect.objectContaining({
      provider: "ollama",
      model: {
        model: "gemma3:4b",
        isCustomModel: false,
        customModel: null,
      },
    }))
    expect(DEFAULT_PROVIDER_CONFIG.ollama).not.toHaveProperty("baseURL")
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.ollama)).toEqual(DEFAULT_PROVIDER_CONFIG.ollama)
  })

  it("places Atlas Cloud second in OpenAI-compatible providers", () => {
    expect(CUSTOM_LLM_PROVIDER_TYPES.slice(0, 4)).toEqual(["openai-compatible", "atlascloud", "openrouter", "minimax"])
    expect(API_PROVIDER_TYPES.slice(0, 4)).toEqual(["openai-compatible", "atlascloud", "openrouter", "minimax"])
    expect(NON_CUSTOM_LLM_PROVIDER_TYPES).not.toContain("openrouter")
    expect(NON_CUSTOM_LLM_PROVIDER_TYPES).not.toContain("minimax")
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.openrouter)).toEqual(DEFAULT_PROVIDER_CONFIG.openrouter)
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.minimax)).toEqual(DEFAULT_PROVIDER_CONFIG.minimax)
  })

  it("places Azure immediately before Bedrock in provider pickers", () => {
    expect(NON_CUSTOM_LLM_PROVIDER_TYPES.indexOf("azure")).toBe(NON_CUSTOM_LLM_PROVIDER_TYPES.indexOf("bedrock") - 1)
    expect(API_PROVIDER_TYPES.indexOf("azure")).toBe(API_PROVIDER_TYPES.indexOf("bedrock") - 1)
  })

  it("defaults top-level reasoning providers to none", () => {
    for (const provider of TOP_LEVEL_REASONING_PROVIDER_TYPES) {
      expect(DEFAULT_PROVIDER_CONFIG[provider].reasoning).toBe("none")
      expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG[provider])).toEqual(DEFAULT_PROVIDER_CONFIG[provider])
    }

    expect(DEFAULT_PROVIDER_CONFIG.azure).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG.openrouter).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG.minimax).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG["openai-compatible"]).not.toHaveProperty("reasoning")
  })

  it("only allows top-level reasoning on supported provider schemas", () => {
    expect(apiProviderConfigItemSchema.parse({
      ...DEFAULT_PROVIDER_CONFIG.openai,
      reasoning: "minimal",
    })).toEqual({
      ...DEFAULT_PROVIDER_CONFIG.openai,
      reasoning: "minimal",
    })

    expect(() => apiProviderConfigItemSchema.parse({
      ...DEFAULT_PROVIDER_CONFIG.openrouter,
      reasoning: "none",
    })).toThrow()
    expect(() => apiProviderConfigItemSchema.parse({
      ...DEFAULT_PROVIDER_CONFIG.azure,
      reasoning: "none",
    })).toThrow()
  })
})
