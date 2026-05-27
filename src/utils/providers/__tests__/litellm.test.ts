import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"

let getStorageItemMock: ReturnType<typeof vi.fn>

const {
  openAICompatibleLanguageModelMock,
  createOpenAICompatibleMock,
} = vi.hoisted(() => {
  const openAICompatibleLanguageModelMock = vi.fn()
  const createOpenAICompatibleMock = vi.fn((_options?: Record<string, unknown>) => ({
    languageModel: openAICompatibleLanguageModelMock,
  }))

  return {
    openAICompatibleLanguageModelMock,
    createOpenAICompatibleMock,
  }
})

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

function createLiteLLMProviderConfig(overrides?: Partial<{
  apiKey: string
  baseURL: string
  customModel: string | null
  headers: Record<string, unknown>
}>) {
  return {
    id: "litellm-default",
    name: "LiteLLM",
    enabled: true,
    provider: "litellm",
    baseURL: overrides?.baseURL ?? "http://localhost:4000/v1",
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: overrides?.customModel ?? "anthropic/claude-haiku-4-5",
    },
    ...(overrides?.apiKey !== undefined && { apiKey: overrides.apiKey }),
    ...(overrides?.headers !== undefined && { headers: overrides.headers }),
  }
}

describe("litellm provider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openAICompatibleLanguageModelMock.mockReturnValue("litellm-model")
    getStorageItemMock = vi.fn()
    ;(storage.getItem as unknown as ReturnType<typeof vi.fn>) = getStorageItemMock
  })

  it("creates an OpenAI-compatible provider with litellm base URL", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createLiteLLMProviderConfig()],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("litellm-default")

    expect(result).toBe("litellm-model")
    expect(createOpenAICompatibleMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "litellm",
      baseURL: "http://localhost:4000/v1",
      supportsStructuredOutputs: true,
    }))
  })

  it("resolves custom model name through the proxy", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createLiteLLMProviderConfig({ customModel: "openai/gpt-4o" })],
    })

    const { getModelById } = await import("../model")
    await getModelById("litellm-default")

    expect(openAICompatibleLanguageModelMock).toHaveBeenCalledWith("openai/gpt-4o")
  })

  it("forwards API key when provided", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createLiteLLMProviderConfig({ apiKey: "sk-litellm-master-key" })],
    })

    const { getModelById } = await import("../model")
    await getModelById("litellm-default")

    expect(createOpenAICompatibleMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "sk-litellm-master-key",
    }))
  })

  it("omits API key when not set", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createLiteLLMProviderConfig()],
    })

    const { getModelById } = await import("../model")
    await getModelById("litellm-default")

    expect(createOpenAICompatibleMock.mock.calls[0]?.[0]).not.toHaveProperty("apiKey")
  })

  it("supports custom base URL for remote proxy", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createLiteLLMProviderConfig({ baseURL: "https://my-litellm.example.com/v1" })],
    })

    const { getModelById } = await import("../model")
    await getModelById("litellm-default")

    expect(createOpenAICompatibleMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://my-litellm.example.com/v1",
    }))
  })

  it("passes custom headers when provided", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createLiteLLMProviderConfig({
        headers: { "X-Custom-Header": "test-value" },
      })],
    })

    const { getModelById } = await import("../model")
    await getModelById("litellm-default")

    expect(createOpenAICompatibleMock).toHaveBeenCalledWith(expect.objectContaining({
      headers: { "X-Custom-Header": "test-value" },
    }))
  })
})
