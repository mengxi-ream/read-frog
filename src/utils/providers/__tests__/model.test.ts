import { storage } from "#imports"
import { beforeEach, describe, expect, it, vi } from "vitest"

let getStorageItemMock: ReturnType<typeof vi.fn>

const {
  anthropicLanguageModelMock,
  openAICompatibleLanguageModelMock,
  createAnthropicMock,
  createOpenAICompatibleMock,
} = vi.hoisted(() => {
  const anthropicLanguageModelMock = vi.fn()
  const openAICompatibleLanguageModelMock = vi.fn()
  const createAnthropicMock = vi.fn((_options?: Record<string, unknown>) => ({
    languageModel: anthropicLanguageModelMock,
  }))
  const createOpenAICompatibleMock = vi.fn((_options?: Record<string, unknown>) => ({
    languageModel: openAICompatibleLanguageModelMock,
  }))

  return {
    anthropicLanguageModelMock,
    openAICompatibleLanguageModelMock,
    createAnthropicMock,
    createOpenAICompatibleMock,
  }
})

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropicMock,
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
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

describe("getModelById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    anthropicLanguageModelMock.mockReturnValue("anthropic-model")
    openAICompatibleLanguageModelMock.mockReturnValue("custom-model")
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
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
      },
    }))
    expect(anthropicLanguageModelMock).toHaveBeenCalledWith("claude-haiku-4-5")
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
