import { describe, expect, it } from "vitest"
import { API_PROVIDER_TYPES, apiProviderConfigItemSchema, NON_CUSTOM_LLM_PROVIDER_TYPES } from "@/types/config/provider"
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
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.azure).toBe("https://<resource>.services.ai.azure.com/openai")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS.openai).toBe("https://api.openai.com/v1")
    expect(PROVIDER_BASE_URL_PLACEHOLDERS["openai-compatible"]).toBe("https://api.example.com/v1")
  })

  it("places Azure immediately before Bedrock in provider pickers", () => {
    expect(NON_CUSTOM_LLM_PROVIDER_TYPES.indexOf("azure")).toBe(NON_CUSTOM_LLM_PROVIDER_TYPES.indexOf("bedrock") - 1)
    expect(API_PROVIDER_TYPES.indexOf("azure")).toBe(API_PROVIDER_TYPES.indexOf("bedrock") - 1)
  })
})
