import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { DEFAULT_PROVIDER_HEADERS } from "../headers"

let getStorageItemMock: ReturnType<typeof vi.fn>

const {
  anthropicLanguageModelMock,
  azureChatModelMock,
  azureLanguageModelMock,
  openAICompatibleLanguageModelMock,
  ollamaLanguageModelMock,
  createAnthropicMock,
  createAzureMock,
  createOllamaMock,
  createOpenAICompatibleMock,
} = vi.hoisted(() => {
  const anthropicLanguageModelMock = vi.fn()
  const azureChatModelMock = vi.fn()
  const azureLanguageModelMock = vi.fn()
  const openAICompatibleLanguageModelMock = vi.fn()
  const ollamaLanguageModelMock = vi.fn()
  const createAnthropicMock = vi.fn((_options?: Record<string, unknown>) => ({
    languageModel: anthropicLanguageModelMock,
  }))
  const createAzureMock = vi.fn((_options?: Record<string, unknown>) => ({
    chat: azureChatModelMock,
    languageModel: azureLanguageModelMock,
  }))
  const createOpenAICompatibleMock = vi.fn((_options?: Record<string, unknown>) => ({
    languageModel: openAICompatibleLanguageModelMock,
  }))
  const createOllamaMock = vi.fn((_options?: Record<string, unknown>) => ({
    languageModel: ollamaLanguageModelMock,
  }))

  return {
    anthropicLanguageModelMock,
    azureChatModelMock,
    azureLanguageModelMock,
    openAICompatibleLanguageModelMock,
    ollamaLanguageModelMock,
    createAnthropicMock,
    createAzureMock,
    createOllamaMock,
    createOpenAICompatibleMock,
  }
})

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropicMock,
}))

vi.mock("@ai-sdk/azure", () => ({
  createAzure: createAzureMock,
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

vi.mock("ai-sdk-ollama", () => ({
  createOllama: createOllamaMock,
}))

function createAnthropicProviderConfig(headers?: Record<string, unknown>) {
  return {
    id: "anthropic-default",
    name: "Anthropic",
    enabled: true,
    provider: "anthropic",
    apiKey: "test-key",
    model: {
      model: "claude-haiku-4-5",
      isCustomModel: false,
      customModel: null,
    },
    ...(headers !== undefined && { headers }),
  }
}

function createOpenRouterProviderConfig(headers?: Record<string, unknown>) {
  return {
    id: "openrouter-default",
    name: "OpenRouter",
    enabled: true,
    provider: "openrouter",
    apiKey: "test-key",
    baseURL: "https://openrouter.ai/api/v1",
    model: {
      model: "x-ai/grok-4-fast:free",
      isCustomModel: false,
      customModel: null,
    },
    ...(headers !== undefined && { headers }),
  }
}

function createOllamaProviderConfig(providerOptions?: Record<string, unknown>) {
  return {
    id: "ollama-default",
    name: "Ollama",
    enabled: true,
    provider: "ollama",
    baseURL: "http://127.0.0.1:11434/",
    model: {
      model: "gemma3:4b",
      isCustomModel: false,
      customModel: null,
    },
    ...(providerOptions !== undefined && { providerOptions }),
  }
}

describe("getModelById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    anthropicLanguageModelMock.mockReturnValue("anthropic-model")
    azureChatModelMock.mockReturnValue("azure-chat-model")
    azureLanguageModelMock.mockReturnValue("azure-model")
    openAICompatibleLanguageModelMock.mockReturnValue("custom-model")
    ollamaLanguageModelMock.mockReturnValue("ollama-model")
    getStorageItemMock = vi.fn()
    ;(storage.getItem as unknown as ReturnType<typeof vi.fn>) = getStorageItemMock
  })

  it("passes default headers for Anthropic when user headers are undefined", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createAnthropicProviderConfig()],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("anthropic-default")

    expect(result).toBe("anthropic-model")
    expect(createAnthropicMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "test-key",
      headers: DEFAULT_PROVIDER_HEADERS.anthropic,
    }))
    expect(anthropicLanguageModelMock).toHaveBeenCalledWith("claude-haiku-4-5")
  })

  it("passes attribution headers for OpenRouter when user headers are undefined", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createOpenRouterProviderConfig()],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("openrouter-default")

    expect(result).toBe("custom-model")
    expect(createOpenAICompatibleMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "test-key",
      headers: DEFAULT_PROVIDER_HEADERS.openrouter,
      supportsStructuredOutputs: true,
    }))
    expect(openAICompatibleLanguageModelMock).toHaveBeenCalledWith("x-ai/grok-4-fast:free")
  })

  it("passes Ollama root base URL and disables think on the language model", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createOllamaProviderConfig({ think: true })],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("ollama-default")

    expect(result).toBe("ollama-model")
    expect(createOllamaMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:11434/",
    })
    expect(ollamaLanguageModelMock).toHaveBeenCalledWith("gemma3:4b", { think: false })
  })

  it("passes Azure settings and resolves the deployment name with languageModel", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [
        {
          id: "azure-default",
          name: "Azure OpenAI",
          enabled: true,
          provider: "azure",
          apiKey: "azure-key",
          baseURL: "https://proxy.example.test/openai",
          model: {
            model: "gpt-5.4-mini",
            isCustomModel: true,
            customModel: "read-frog-gpt-4o",
          },
          providerSpecificSettings: {
            apiMode: "responses",
            resourceName: "read-frog-openai",
            apiVersion: "2025-04-01-preview",
          },
          headers: {
            "X-Test": "1",
          },
        },
      ],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("azure-default")

    expect(result).toBe("azure-model")
    expect(createAzureMock).toHaveBeenCalledWith(expect.objectContaining({
      resourceName: "read-frog-openai",
      apiVersion: "2025-04-01-preview",
      baseURL: "https://proxy.example.test/openai",
      apiKey: "azure-key",
      headers: {
        "X-Test": "1",
      },
    }))
    expect(createAzureMock.mock.calls[0]?.[0]).not.toHaveProperty("apiMode")
    expect(createAzureMock.mock.calls[0]?.[0]).not.toHaveProperty("region")
    expect(azureLanguageModelMock).toHaveBeenCalledWith("read-frog-gpt-4o")
    expect(azureChatModelMock).not.toHaveBeenCalled()
  })

  it("uses Azure chat completions when API mode is chat", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [
        {
          id: "azure-default",
          name: "Azure OpenAI",
          enabled: true,
          provider: "azure",
          apiKey: "azure-key",
          baseURL: "https://proxy.example.test/openai",
          model: {
            model: "gpt-5.4-mini",
            isCustomModel: true,
            customModel: "read-frog-gpt-4o",
          },
          providerSpecificSettings: {
            apiMode: "chat",
            resourceName: "read-frog-openai",
            apiVersion: "2025-04-01-preview",
          },
        },
      ],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("azure-default")

    expect(result).toBe("azure-chat-model")
    expect(createAzureMock).toHaveBeenCalledWith(expect.objectContaining({
      resourceName: "read-frog-openai",
      apiVersion: "2025-04-01-preview",
      baseURL: "https://proxy.example.test/openai",
      apiKey: "azure-key",
    }))
    expect(createAzureMock.mock.calls[0]?.[0]).not.toHaveProperty("apiMode")
    expect(createAzureMock.mock.calls[0]?.[0]).not.toHaveProperty("region")
    expect(azureChatModelMock).toHaveBeenCalledWith("read-frog-gpt-4o")
    expect(azureLanguageModelMock).not.toHaveBeenCalled()
  })

  it("uses user headers as a full override for Anthropic", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createAnthropicProviderConfig({ "X-Test": "1" })],
    })

    const { getModelById } = await import("../model")
    await getModelById("anthropic-default")

    expect(createAnthropicMock).toHaveBeenCalledWith(expect.objectContaining({
      headers: {
        "X-Test": "1",
      },
    }))
  })

  it("omits headers for Anthropic when user headers are an explicit empty object", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [createAnthropicProviderConfig({})],
    })

    const { getModelById } = await import("../model")
    await getModelById("anthropic-default")

    expect(createAnthropicMock.mock.calls[0]?.[0]).not.toHaveProperty("headers")
  })

  it("passes custom headers for OpenAI-compatible providers", async () => {
    getStorageItemMock.mockResolvedValue({
      providersConfig: [
        {
          id: "custom-openai",
          name: "Custom Provider",
          enabled: true,
          provider: "openai-compatible",
          apiKey: "custom-key",
          baseURL: "http://127.0.0.1:1234/v1",
          model: {
            model: "use-custom-model",
            isCustomModel: true,
            customModel: "huihui-hy-mt1.5-1.8b-abliterated",
          },
          headers: {
            "HTTP-Referer": "https://example.com",
            "X-Title": "Read Frog",
          },
        },
      ],
    })

    const { getModelById } = await import("../model")
    const result = await getModelById("custom-openai")

    expect(result).toBe("custom-model")
    expect(createOpenAICompatibleMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "openai-compatible",
      baseURL: "http://127.0.0.1:1234/v1",
      apiKey: "custom-key",
      headers: {
        "HTTP-Referer": "https://example.com",
        "X-Title": "Read Frog",
      },
    }))
    expect(openAICompatibleLanguageModelMock).toHaveBeenCalledWith("huihui-hy-mt1.5-1.8b-abliterated")
  })
})
