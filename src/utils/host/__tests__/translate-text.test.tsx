// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { translateTextForPage, translateTextForPageTitle } from "@/utils/host/translate/translate-variants"
import { getTranslatePrompt } from "@/utils/prompts/translate"

// Mock dependencies
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

vi.mock("@/utils/host/translate/api/microsoft", () => ({
  microsoftTranslate: vi.fn(),
}))

vi.mock("@/utils/prompts/translate", () => ({
  getTranslatePrompt: vi.fn(),
}))

vi.mock("@/utils/host/translate/article-context", () => ({
  getOrFetchArticleData: vi.fn(),
}))

let mockSendMessage: any
let mockMicrosoftTranslate: any
let mockGetConfigFromStorage: any
let mockGetTranslatePrompt: any
let mockGetOrFetchArticleData: any

describe("translate-text", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    document.title = "Document Title"
    document.body.innerHTML = "<main>Body content</main>"
    mockSendMessage = vi.mocked((await import("@/utils/message")).sendMessage)
    mockMicrosoftTranslate = vi.mocked((await import("@/utils/host/translate/api/microsoft")).microsoftTranslate)
    mockGetConfigFromStorage = vi.mocked((await import("@/utils/config/storage")).getLocalConfig)
    mockGetTranslatePrompt = vi.mocked((await import("@/utils/prompts/translate")).getTranslatePrompt)
    mockGetOrFetchArticleData = vi.mocked((await import("@/utils/host/translate/article-context")).getOrFetchArticleData)

    // Mock getOrFetchArticleData to return document.title
    mockGetOrFetchArticleData.mockImplementation(() => Promise.resolve({ title: document.title }))

    // Mock getConfigFromStorage to return DEFAULT_CONFIG
    mockGetConfigFromStorage.mockResolvedValue(DEFAULT_CONFIG)

    // Mock getTranslatePrompt to return a simple prompt pair
    mockGetTranslatePrompt.mockResolvedValue({
      systemPrompt: "Translate to {{targetLang}}",
      prompt: "{{input}}",
    })
  })

  describe("translateTextForPage", () => {
    it("should send message with correct parameters", async () => {
      mockSendMessage.mockResolvedValue("translated text")

      const result = await translateTextForPage("test text")

      expect(result).toBe("translated text")
      expect(mockSendMessage).toHaveBeenCalledWith("enqueueTranslateRequest", expect.objectContaining({
        text: "test text",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: expect.any(Object),
        scheduleAt: expect.any(Number),
        hash: expect.any(String),
      }))
    })
  })

  describe("translateTextForPageTitle", () => {
    it("should use the latest original title instead of document.title when building article context", async () => {
      const llmConfig = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          providerId: "openai-default",
          enableAIContentAware: false,
        },
      }

      mockGetConfigFromStorage.mockResolvedValue(llmConfig)
      mockSendMessage.mockImplementation(async (type: string) => {
        if (type === "enqueueTranslateRequest") {
          return "translated page title"
        }
        return undefined
      })
      document.title = "Translated Browser Title"

      const result = await translateTextForPageTitle("Source Title To Translate")

      expect(result).toBe("translated page title")
      expect(mockSendMessage).toHaveBeenCalledWith("enqueueTranslateRequest", expect.objectContaining({
        text: "Source Title To Translate",
        articleTitle: "Source Title To Translate",
      }))
    })

    it("should forward document.title to regular page translations", async () => {
      const llmConfig = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          providerId: "openai-default",
          enableAIContentAware: false,
        },
      }

      mockGetConfigFromStorage.mockResolvedValue(llmConfig)
      mockSendMessage.mockImplementation(async (type: string) => {
        if (type === "enqueueTranslateRequest") {
          return "translated body text"
        }
        return undefined
      })
      document.title = "Translated Browser Title"

      const result = await translateTextForPage("Body text")

      expect(result).toBe("translated body text")
      expect(mockSendMessage).toHaveBeenCalledWith("enqueueTranslateRequest", expect.objectContaining({
        text: "Body text",
        articleTitle: "Translated Browser Title",
      }))
    })
  })

  describe("executeTranslate", () => {
    const langConfig = {
      sourceCode: "eng" as const,
      targetCode: "cmn" as const,
      detectedCode: "eng" as const,
      level: "intermediate" as const,
    }

    const providerConfig = {
      id: "microsoft-default",
      enabled: true,
      name: "Microsoft Translator",
      provider: "microsoft-translate" as const,
    }

    it("should return empty string for empty/whitespace input", async () => {
      expect(await executeTranslate("", langConfig, providerConfig, getTranslatePrompt)).toBe("")
      expect(await executeTranslate(" ", langConfig, providerConfig, getTranslatePrompt)).toBe("")
      expect(await executeTranslate("\n", langConfig, providerConfig, getTranslatePrompt)).toBe("")
      expect(await executeTranslate(" \n ", langConfig, providerConfig, getTranslatePrompt)).toBe("")
      expect(await executeTranslate(" \n \t", langConfig, providerConfig, getTranslatePrompt)).toBe("")
    })

    it("should handle zero-width spaces correctly", async () => {
      // Only zero-width spaces should return empty
      expect(await executeTranslate("\u200B\u200B", langConfig, providerConfig, getTranslatePrompt)).toBe("")

      // Mixed invisible + whitespace should return empty
      expect(await executeTranslate("\u200B \u200B", langConfig, providerConfig, getTranslatePrompt)).toBe("")

      // Should translate valid content after removing zero-width spaces
      mockMicrosoftTranslate.mockResolvedValue("你好")
      const result = await executeTranslate("\u200B hello \u200B", langConfig, providerConfig, getTranslatePrompt)
      expect(result).toBe("你好")
      // Microsoft translate should receive the original text
      expect(mockMicrosoftTranslate).toHaveBeenCalledWith("\u200B hello \u200B", "en", "zh")
    })

    it("should trim translation result", async () => {
      mockMicrosoftTranslate.mockResolvedValue("  测试结果  ")

      const result = await executeTranslate("test input", langConfig, providerConfig, getTranslatePrompt)

      expect(result).toBe("测试结果")
    })
  })
})
