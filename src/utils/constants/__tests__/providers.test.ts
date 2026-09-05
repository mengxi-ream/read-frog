import { describe, expect, it } from "vitest"
import {
  API_PROVIDER_TYPES,
  CUSTOM_MODEL_ONLY_PROVIDER_TYPES,
  DEDICATED_LLM_PROVIDER_TYPES,
  LLM_PROVIDER_TYPES,
  OPEN_RESPONSES_LLM_PROVIDER_TYPES,
  OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES,
  PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES,
  apiProviderConfigItemSchema,
  providersConfigSchema,
  TOP_LEVEL_REASONING_PROVIDER_TYPES,
} from "@/types/config/provider"
import {
  DEFAULT_PROVIDER_CONFIG,
  PROVIDER_GROUPS,
  PROVIDER_ITEMS,
  PROVIDER_URL_PLACEHOLDERS,
} from "../providers"

describe("provider constants", () => {
  it("keeps every default provider compatible with its model schema", () => {
    for (const provider of API_PROVIDER_TYPES) {
      expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG[provider])).toEqual(
        DEFAULT_PROVIDER_CONFIG[provider],
      )
    }
  })

  it("uses the original custom provider SVG shape for both custom protocols", () => {
    expect(PROVIDER_ITEMS["openai-compatible"].logo("light")).toContain("custom-provider.svg")
    expect(PROVIDER_ITEMS["openai-compatible"].logo("dark")).toContain("custom-provider.svg")
    expect(PROVIDER_ITEMS["open-responses"].logo("light")).toContain("custom-responses.svg")
    expect(PROVIDER_ITEMS["open-responses"].logo("dark")).toContain("custom-responses.svg")
  })

  it("defines Azure with the LobeHub color icon and GPT shortcut defaults", () => {
    expect(PROVIDER_ITEMS.azure.logo("light")).toContain("/light/azure-color.webp")
    expect(PROVIDER_ITEMS.azure.logo("dark")).toContain("/dark/azure-color.webp")

    expect(DEFAULT_PROVIDER_CONFIG.azure).toEqual(
      expect.objectContaining({
        id: "azure-default",
        name: "Azure",
        provider: "azure",
        model: {
          model: "gpt-5.6-luna",
          isCustomModel: false,
          customModel: null,
        },
        providerSpecificSettings: {
          apiMode: "responses",
          apiVersion: "v1",
        },
      }),
    )
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.azure)).toEqual(
      DEFAULT_PROVIDER_CONFIG.azure,
    )
  })

  it("defines provider-specific URL placeholders", () => {
    expect(PROVIDER_URL_PLACEHOLDERS.atlascloud).toBe("https://api.atlascloud.ai/v1")
    expect(PROVIDER_URL_PLACEHOLDERS.azure).toBe("https://<resource>.services.ai.azure.com/openai")
    expect(PROVIDER_URL_PLACEHOLDERS.openai).toBe("https://api.openai.com/v1")
    expect(PROVIDER_URL_PLACEHOLDERS["openai-compatible"]).toBe("https://api.example.com/v1")
    expect(PROVIDER_URL_PLACEHOLDERS["open-responses"]).toBe("https://api.example.com/v1/responses")
    expect(PROVIDER_URL_PLACEHOLDERS.openrouter).toBe("https://openrouter.ai/api/v1")
    expect(PROVIDER_URL_PLACEHOLDERS.ollama).toBe("http://127.0.0.1:11434/")
    expect(PROVIDER_URL_PLACEHOLDERS.minimax).toBe("https://api.minimax.io/v1")
  })

  it("defines Ollama without injecting the root URL into the default config", () => {
    expect(DEFAULT_PROVIDER_CONFIG.ollama).toEqual(
      expect.objectContaining({
        provider: "ollama",
        model: {
          model: "gemma3:4b",
          isCustomModel: false,
          customModel: null,
        },
      }),
    )
    expect(DEFAULT_PROVIDER_CONFIG.ollama).not.toHaveProperty("baseURL")
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.ollama)).toEqual(
      DEFAULT_PROVIDER_CONFIG.ollama,
    )
  })

  it("defines disjoint and exhaustive protocol-adapter taxonomies", () => {
    expect(OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES).toEqual([
      "openai-compatible",
      "jalapenocloud",
      "atlascloud",
      "openrouter",
      "minimax",
      "siliconflow",
      "tensdaq",
      "volcengine",
    ])
    expect(OPEN_RESPONSES_LLM_PROVIDER_TYPES).toEqual(["open-responses"])
    expect(PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES.slice(0, 5)).toEqual([
      "openai-compatible",
      "open-responses",
      "jalapenocloud",
      "atlascloud",
      "openrouter",
    ])
    expect(CUSTOM_MODEL_ONLY_PROVIDER_TYPES).toEqual(["openai-compatible", "open-responses"])

    const openAICompatibleTypes = new Set<string>(OPENAI_COMPATIBLE_LLM_PROVIDER_TYPES)
    const openResponsesTypes = new Set<string>(OPEN_RESPONSES_LLM_PROVIDER_TYPES)
    const protocolCompatibleTypes = new Set<string>(PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES)
    const dedicatedTypes = new Set<string>(DEDICATED_LLM_PROVIDER_TYPES)

    expect([...openAICompatibleTypes].filter((type) => openResponsesTypes.has(type))).toEqual([])
    expect([...protocolCompatibleTypes].sort()).toEqual(
      [...openAICompatibleTypes, ...openResponsesTypes].sort(),
    )
    expect([...protocolCompatibleTypes].filter((type) => dedicatedTypes.has(type))).toEqual([])
    expect([...protocolCompatibleTypes, ...dedicatedTypes].sort()).toEqual(
      [...LLM_PROVIDER_TYPES].sort(),
    )
    expect(API_PROVIDER_TYPES.slice(0, 5)).toEqual(
      PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES.slice(0, 5),
    )
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.openrouter)).toEqual(
      DEFAULT_PROVIDER_CONFIG.openrouter,
    )
    expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG.minimax)).toEqual(
      DEFAULT_PROVIDER_CONFIG.minimax,
    )
  })

  it("uses distinct connection URL fields for the two protocol adapters", () => {
    const openAICompatibleConfig = DEFAULT_PROVIDER_CONFIG["openai-compatible"]
    expect(apiProviderConfigItemSchema.parse(openAICompatibleConfig)).toEqual(
      openAICompatibleConfig,
    )

    const { baseURL: _baseURL, ...openAICompatibleWithoutBaseURL } = openAICompatibleConfig
    expect(() => apiProviderConfigItemSchema.parse(openAICompatibleWithoutBaseURL)).toThrow(
      /expected string/,
    )
    expect(() =>
      apiProviderConfigItemSchema.parse({
        ...openAICompatibleConfig,
        url: "https://api.example.com/v1/responses",
      }),
    ).toThrow(/Unrecognized key/)

    const openResponsesConfig = {
      id: "open-responses-test",
      name: "Open Responses test",
      enabled: true,
      provider: "open-responses" as const,
      url: "https://api.example.com/v1/responses",
      model: DEFAULT_PROVIDER_CONFIG["open-responses"].model,
    }
    expect(apiProviderConfigItemSchema.parse(openResponsesConfig)).toEqual(openResponsesConfig)

    const { url: _url, ...openResponsesWithoutURL } = openResponsesConfig
    expect(() => apiProviderConfigItemSchema.parse(openResponsesWithoutURL)).toThrow(
      /expected string/,
    )
    expect(() =>
      apiProviderConfigItemSchema.parse({
        ...openResponsesConfig,
        baseURL: "https://api.example.com/v1",
      }),
    ).toThrow(/Unrecognized key/)
  })

  it("keeps existing OpenAI-compatible ids and saved names unchanged", () => {
    const existingConfig = {
      ...DEFAULT_PROVIDER_CONFIG["openai-compatible"],
      id: "openai-compatible-default",
      name: "Custom Provider",
    }

    expect(providersConfigSchema.parse([existingConfig])).toEqual([existingConfig])
  })

  it("groups both protocol adapters under the compatible providers key", () => {
    expect(PROVIDER_GROUPS.compatibleProviders.types).toEqual(
      PROTOCOL_COMPATIBLE_LLM_PROVIDER_TYPES,
    )
    expect(PROVIDER_GROUPS).not.toHaveProperty("openaiCompatibleProviders")
  })

  it("places Azure immediately before Bedrock in provider pickers", () => {
    expect(DEDICATED_LLM_PROVIDER_TYPES.indexOf("azure")).toBe(
      DEDICATED_LLM_PROVIDER_TYPES.indexOf("bedrock") - 1,
    )
    expect(API_PROVIDER_TYPES.indexOf("azure")).toBe(API_PROVIDER_TYPES.indexOf("bedrock") - 1)
  })

  it("defaults top-level reasoning providers to none", () => {
    for (const provider of TOP_LEVEL_REASONING_PROVIDER_TYPES) {
      expect(DEFAULT_PROVIDER_CONFIG[provider].reasoning).toBe("none")
      expect(apiProviderConfigItemSchema.parse(DEFAULT_PROVIDER_CONFIG[provider])).toEqual(
        DEFAULT_PROVIDER_CONFIG[provider],
      )
    }

    expect(DEFAULT_PROVIDER_CONFIG.azure).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG.openrouter).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG.minimax).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG["openai-compatible"]).not.toHaveProperty("reasoning")
    expect(DEFAULT_PROVIDER_CONFIG["open-responses"]).not.toHaveProperty("reasoning")
  })

  it("only allows top-level reasoning on supported provider schemas", () => {
    expect(
      apiProviderConfigItemSchema.parse({
        ...DEFAULT_PROVIDER_CONFIG.openai,
        reasoning: "minimal",
      }),
    ).toEqual({
      ...DEFAULT_PROVIDER_CONFIG.openai,
      reasoning: "minimal",
    })

    expect(() =>
      apiProviderConfigItemSchema.parse({
        ...DEFAULT_PROVIDER_CONFIG.openrouter,
        reasoning: "none",
      }),
    ).toThrow(/Unrecognized key/)
    expect(() =>
      apiProviderConfigItemSchema.parse({
        ...DEFAULT_PROVIDER_CONFIG.azure,
        reasoning: "none",
      }),
    ).toThrow(/Unrecognized key/)
  })
})
