import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: vi.fn(),
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

describe("translation queue helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes only llm providers through the batch queue", async () => {
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

    expect(shouldUseBatchQueue(deeplProvider)).toBe(false)
    expect(shouldUseBatchQueue(deeplxProvider)).toBe(false)
    expect(shouldUseBatchQueue(llmProvider)).toBe(true)
  })
})
