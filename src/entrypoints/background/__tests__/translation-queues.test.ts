import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: vi.fn(),
}))

vi.mock("@/utils/host/translate/api/deepl", () => ({
  deeplTranslateBatch: vi.fn(),
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    articleSummaryCache: {
      get: vi.fn(),
      put: vi.fn(),
    },
    translationCache: {
      get: vi.fn(),
      put: vi.fn(),
    },
  },
}))

const mockPromptResolver = vi.fn().mockResolvedValue({ systemPrompt: "", prompt: "" })

describe("translation queue helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes only llm providers and official deepl through the batch queue", async () => {
    const { shouldUseBatchQueue } = await import("../translation-queues")

    const deeplProvider: ProviderConfig = {
      id: "deepl",
      name: "DeepL",
      provider: "deepl",
      enabled: true,
      apiKey: "key",
    }

    const deeplxProvider: ProviderConfig = {
      id: "deeplx",
      name: "DeepLX",
      provider: "deeplx",
      enabled: true,
      baseURL: "https://api.deeplx.org",
    }

    const llmProvider: ProviderConfig = {
      id: "openai",
      name: "OpenAI",
      provider: "openai",
      enabled: true,
      apiKey: "sk-test",
      model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
    }

    expect(shouldUseBatchQueue(deeplProvider)).toBe(true)
    expect(shouldUseBatchQueue(deeplxProvider)).toBe(false)
    expect(shouldUseBatchQueue(llmProvider)).toBe(true)
  })

  it("uses native DeepL batching instead of separator-based executeTranslate", async () => {
    const { executeBatchTranslation } = await import("../translation-queues")
    const { executeTranslate } = await import("@/utils/host/translate/execute-translate")
    const { deeplTranslateBatch } = await import("@/utils/host/translate/api/deepl")

    vi.mocked(deeplTranslateBatch).mockResolvedValue(["你好", "世界"])

    const result = await executeBatchTranslation([
      {
        text: "Hello",
        langConfig: { sourceCode: "eng", targetCode: "cmn", level: "beginner" },
        providerConfig: {
          id: "deepl",
          name: "DeepL",
          provider: "deepl",
          enabled: true,
          apiKey: "test-key",
        },
        hash: "hash-1",
        scheduleAt: Date.now(),
      },
      {
        text: "World",
        langConfig: { sourceCode: "eng", targetCode: "cmn", level: "beginner" },
        providerConfig: {
          id: "deepl",
          name: "DeepL",
          provider: "deepl",
          enabled: true,
          apiKey: "test-key",
        },
        hash: "hash-2",
        scheduleAt: Date.now(),
      },
    ], mockPromptResolver)

    expect(result).toEqual(["你好", "世界"])
    expect(deeplTranslateBatch).toHaveBeenCalledWith(["Hello", "World"], "en", "zh", expect.objectContaining({
      provider: "deepl",
    }))
    expect(executeTranslate).not.toHaveBeenCalled()
  })
})
