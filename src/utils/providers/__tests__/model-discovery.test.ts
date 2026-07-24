import type { LLMProviderConfig } from "@/types/config/provider"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  fetchAnthropicModels,
  fetchDeepInfraModels,
  fetchGoogleModels,
  fetchOpenAICompatibleModels,
  getModelDiscovery,
  MODEL_DISCOVERY_DESCRIPTORS,
} from "../model-discovery"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>()
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response)
  }
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchOpenAICompatibleModels", () => {
  it("parses the standard { data: [{ id }] } shape and sends bearer auth", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ object: "list", data: [{ id: "gpt-test" }, { id: "gpt-mini" }] }),
    )

    const models = await fetchOpenAICompatibleModels("https://api.example.com/v1", "sk-test")

    expect(models).toEqual(["gpt-test", "gpt-mini"])
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/v1/models", {
      headers: { Authorization: "Bearer sk-test" },
    })
  })

  it("tolerates bare arrays and name-keyed entries, deduping empty ids", async () => {
    mockFetch(jsonResponse([{ name: "model-a" }, { id: "model-b" }, { id: "model-b" }, {}]))

    const models = await fetchOpenAICompatibleModels("https://api.example.com/v1", "sk-test")

    expect(models).toEqual(["model-a", "model-b"])
  })

  it("normalizes the base URL and omits entries explicitly marked as non-text models", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        data: [
          { id: "chat-model", capabilities: { completion_chat: true } },
          { id: "embedding-model", type: "embedding" },
          { id: "image-model", capabilities: { chat: false } },
          { id: "audio-model", architecture: { output_modalities: ["audio"] } },
          { id: "retired-model", deprecated: true },
          { id: "trimmed-model " },
        ],
      }),
    )

    const models = await fetchOpenAICompatibleModels("https://api.example.com/v1/", "sk-test")

    expect(models).toEqual(["chat-model", "trimmed-model"])
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/v1/models", {
      headers: { Authorization: "Bearer sk-test" },
    })
  })

  it("surfaces API error messages", async () => {
    mockFetch(jsonResponse({ error: { message: "invalid key" } }, 401))

    await expect(fetchOpenAICompatibleModels("https://api.example.com/v1", "bad")).rejects.toThrow(
      "invalid key",
    )
  })
})

describe("fetchDeepInfraModels", () => {
  it("uses the public catalog and keeps only available text-generation models", async () => {
    const fetchMock = mockFetch(
      jsonResponse([
        {
          model_name: "chat-model",
          type: "text-generation",
          deprecated: false,
          private: false,
        },
        { model_name: "image-model", type: "text-to-image" },
        { model_name: "retired-model", type: "text-generation", deprecated: true },
        { model_name: "private-model", type: "text-generation", private: true },
      ]),
    )

    const models = await fetchDeepInfraModels("https://api.deepinfra.com/v1", "")

    expect(models).toEqual(["chat-model"])
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepinfra.com/models/list", {
      headers: {},
    })
  })
})

describe("fetchGoogleModels", () => {
  it("filters to generateContent models, strips the models/ prefix, and paginates", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        models: [
          { name: "models/gemini-test-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
        ],
        nextPageToken: "page-2",
      }),
      jsonResponse({
        models: [
          { name: "models/gemini-test-pro", supportedGenerationMethods: ["generateContent"] },
        ],
      }),
    )

    const models = await fetchGoogleModels(
      "https://generativelanguage.googleapis.com/v1beta",
      "goog-key",
    )

    expect(models).toEqual(["gemini-test-flash", "gemini-test-pro"])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // The API key must travel in a header, never in the URL.
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.not.stringContaining("goog-key"), {
      headers: { "x-goog-api-key": "goog-key" },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pageToken=page-2"),
      expect.anything(),
    )
  })

  it("supports the supportedActions capability field", async () => {
    mockFetch(
      jsonResponse({
        models: [{ name: "models/gemini-test", supportedActions: ["generateContent"] }],
      }),
    )

    const models = await fetchGoogleModels(
      "https://generativelanguage.googleapis.com/v1beta",
      "goog-key",
    )

    expect(models).toEqual(["gemini-test"])
  })
})

describe("fetchAnthropicModels", () => {
  it("collects ids across pages using after_id pagination", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ data: [{ id: "claude-a" }], has_more: true, last_id: "claude-a" }),
      jsonResponse({ data: [{ id: "claude-b" }], has_more: false, last_id: "claude-b" }),
    )

    const models = await fetchAnthropicModels("https://api.anthropic.com/v1", "sk-ant")

    expect(models).toEqual(["claude-a", "claude-b"])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.not.stringContaining("sk-ant"), {
      headers: { "x-api-key": "sk-ant", "anthropic-version": "2023-06-01" },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("after_id=claude-a"),
      expect.anything(),
    )
  })
})

describe("getModelDiscovery", () => {
  const googleConfig = {
    id: "google-default",
    name: "Gemini",
    enabled: true,
    provider: "google",
    apiKey: "goog-key",
    model: { model: "gemini-2.5-flash", isCustomModel: false, customModel: null },
  } as unknown as LLMProviderConfig

  it("uses the descriptor endpoint for built-in providers", async () => {
    const fetchMock = mockFetch(jsonResponse({ models: [] }))

    const discovery = getModelDiscovery(googleConfig)
    expect(discovery?.endpoint).toBe("https://generativelanguage.googleapis.com/v1beta")
    await discovery!.fetchModels()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://generativelanguage.googleapis.com/v1beta/models"),
      expect.anything(),
    )
  })

  it.each([["togetherai", "https://api.together.ai/v1"]] as const)(
    "keeps the %s model-list endpoint separate from its provider client path",
    async (provider, endpoint) => {
      const fetchMock = mockFetch(jsonResponse({ data: [] }))
      const config = {
        ...googleConfig,
        id: `${provider}-default`,
        provider,
      } as unknown as LLMProviderConfig

      const discovery = getModelDiscovery(config)
      expect(discovery?.endpoint).toBe(endpoint)
      await discovery!.fetchModels()

      expect(fetchMock).toHaveBeenCalledWith(`${endpoint}/models`, expect.anything())
    },
  )

  it("discovers DeepInfra through its unauthenticated text-model catalog", async () => {
    const fetchMock = mockFetch(jsonResponse([]))
    const discovery = getModelDiscovery({
      ...googleConfig,
      id: "deepinfra-default",
      provider: "deepinfra",
      apiKey: undefined,
    } as unknown as LLMProviderConfig)

    expect(discovery?.endpoint).toBe("https://api.deepinfra.com/v1")
    await discovery!.fetchModels()

    expect(fetchMock).toHaveBeenCalledWith("https://api.deepinfra.com/models/list", {
      headers: {},
    })
  })

  it("discovers Hugging Face without an API key", async () => {
    const fetchMock = mockFetch(jsonResponse({ data: [] }))
    const discovery = getModelDiscovery({
      ...googleConfig,
      id: "huggingface-default",
      provider: "huggingface",
      apiKey: undefined,
    } as unknown as LLMProviderConfig)

    await discovery!.fetchModels()

    expect(fetchMock).toHaveBeenCalledWith("https://router.huggingface.co/v1/models", {
      headers: {},
    })
  })

  it("sends the default provider headers alongside auth", async () => {
    const fetchMock = mockFetch(jsonResponse({ data: [] }))

    const anthropicConfig = {
      id: "anthropic-default",
      name: "Anthropic",
      enabled: true,
      provider: "anthropic",
      apiKey: "sk-ant",
      model: { model: "claude-haiku-4-5", isCustomModel: false, customModel: null },
    } as unknown as LLMProviderConfig

    await getModelDiscovery(anthropicConfig)!.fetchModels()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("api.anthropic.com"), {
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
        "x-api-key": "sk-ant",
        "anthropic-version": "2023-06-01",
      },
    })
  })

  it("honors user-configured headers over the defaults", async () => {
    const fetchMock = mockFetch(jsonResponse({ models: [] }))

    await getModelDiscovery({
      ...googleConfig,
      headers: { "x-proxy-auth": "proxy-token" },
    })!.fetchModels()

    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), {
      headers: { "x-proxy-auth": "proxy-token", "x-goog-api-key": "goog-key" },
    })
  })

  it("prefers a user-configured baseURL over the descriptor default", async () => {
    const fetchMock = mockFetch(jsonResponse({ models: [] }))

    const discovery = getModelDiscovery({
      ...googleConfig,
      baseURL: "https://proxy.example.com/v1beta",
    })
    expect(discovery?.endpoint).toBe("https://proxy.example.com/v1beta")
    await discovery!.fetchModels()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://proxy.example.com/v1beta/models"),
      expect.anything(),
    )
  })

  it("uses the config baseURL for custom providers and hides the feature without one", async () => {
    const customConfig = {
      id: "custom-1",
      name: "Custom",
      enabled: true,
      provider: "openai-compatible",
      apiKey: "sk-custom",
      baseURL: "https://custom.example.com/v1",
      model: { model: "use-custom-model", isCustomModel: true, customModel: "my-model" },
    } as unknown as LLMProviderConfig

    expect(getModelDiscovery(customConfig)?.endpoint).toBe("https://custom.example.com/v1")
    expect(getModelDiscovery({ ...customConfig, baseURL: "" })).toBeUndefined()

    const fetchMock = mockFetch(jsonResponse({ data: [] }))
    await getModelDiscovery({ ...customConfig, apiKey: undefined })!.fetchModels()
    expect(fetchMock).toHaveBeenCalledWith("https://custom.example.com/v1/models", {
      headers: {},
    })
  })

  it("returns undefined for providers without a descriptor", () => {
    const bedrockConfig = {
      id: "bedrock-default",
      name: "Bedrock",
      enabled: true,
      provider: "bedrock",
      model: { model: "amazon.titan-tg1-large", isCustomModel: false, customModel: null },
    } as unknown as LLMProviderConfig

    expect(MODEL_DISCOVERY_DESCRIPTORS).not.toHaveProperty("bedrock")
    expect(getModelDiscovery(bedrockConfig)).toBeUndefined()
  })

  it("does not enable authenticated discovery before an API key is configured", () => {
    expect(getModelDiscovery({ ...googleConfig, apiKey: undefined })).toBeUndefined()
    expect(getModelDiscovery({ ...googleConfig, apiKey: "   " })).toBeUndefined()
  })
})
