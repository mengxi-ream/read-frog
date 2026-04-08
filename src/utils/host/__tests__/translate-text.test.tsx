// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { translateTextForInput, translateTextForPage, translateTextForPageTitle } from "@/utils/host/translate/translate-variants"
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

vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: vi.fn(),
}))

vi.mock("@/utils/host/translate/webpage-summary", () => ({
  getOrGenerateWebPageSummary: vi.fn(),
}))

let mockSendMessage: any
let mockMicrosoftTranslate: any
let mockGetConfigFromStorage: any
let mockGetTranslatePrompt: any
let mockGetOrCreateWebPageContext: any
let mockGetOrGenerateWebPageSummary: any

describe("translate-text", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    document.title = "Document Title"
    document.body.innerHTML = "<main>Body content</main>"
    mockSendMessage = vi.mocked((await import("@/utils/message")).sendMessage)
    mockMicrosoftTranslate = vi.mocked((await import("@/utils/host/translate/api/microsoft")).microsoftTranslate)
    mockGetConfigFromStorage = vi.mocked((await import("@/utils/config/storage")).getLocalConfig)
    mockGetTranslatePrompt = vi.mocked((await import("@/utils/prompts/translate")).getTranslatePrompt)
    mockGetOrCreateWebPageContext = vi.mocked((await import("@/utils/host/translate/webpage-context")).getOrCreateWebPageContext)
    mockGetOrGenerateWebPageSummary = vi.mocked((await import("@/utils/host/translate/webpage-summary")).getOrGenerateWebPageSummary)

    // Mock getOrCreateWebPageContext to return stable webpage metadata
    mockGetOrCreateWebPageContext.mockImplementation(() => Promise.resolve({
      url: window.location.href,
      webTitle: document.title,
      webContent: document.body.textContent || "",
    }))
    mockGetOrGenerateWebPageSummary.mockResolvedValue("Generated summary")

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
      expect(mockGetOrCreateWebPageContext).not.toHaveBeenCalled()
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
    })
  })

  describe("translateTextForPageTitle", () => {
    it("should use the latest original title instead of document.title when building webpage context", async () => {
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
        webTitle: "Source Title To Translate",
      }))
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
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
        webTitle: "Translated Browser Title",
      }))
    })
  })

  describe("translateTextForInput", () => {
    it("skips webpage context loading for non-llm input translations", async () => {
      mockSendMessage.mockResolvedValue("translated input")

      const result = await translateTextForInput("hello", "eng", "cmn")

      expect(result).toBe("translated input")
      expect(mockGetOrCreateWebPageContext).not.toHaveBeenCalled()
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
      expect(mockSendMessage).toHaveBeenCalledWith("enqueueTranslateRequest", expect.objectContaining({
        text: "hello",
        webTitle: undefined,
        webContent: undefined,
        webSummary: undefined,
      }))
    })

    it("includes webpage summary for AI-aware llm input translations", async () => {
      const llmConfig = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          enableAIContentAware: true,
        },
        inputTranslation: {
          ...DEFAULT_CONFIG.inputTranslation,
          providerId: "openai-default",
        },
      }

      mockGetConfigFromStorage.mockResolvedValue(llmConfig)
      mockSendMessage.mockImplementation(async (type: string) => {
        if (type === "enqueueTranslateRequest") {
          return "translated input"
        }
        if (type === "getOrGenerateWebPageSummary") {
          return "Generated summary"
        }
        return undefined
      })

      const result = await translateTextForInput("hello", "eng", "cmn")

      expect(result).toBe("translated input")
      expect(mockGetOrGenerateWebPageSummary).toHaveBeenCalledTimes(1)
      expect(mockSendMessage).toHaveBeenCalledWith("enqueueTranslateRequest", expect.objectContaining({
        text: "hello",
        webTitle: "Document Title",
        webContent: "Body content",
        webSummary: "Generated summary",
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
      // Shared translation core should send minimally prepared text to the provider
      expect(mockMicrosoftTranslate).toHaveBeenCalledWith("hello", "en", "zh")
    })

    it("should trim translation result", async () => {
      mockMicrosoftTranslate.mockResolvedValue("  测试结果  ")

      const result = await executeTranslate("test input", langConfig, providerConfig, getTranslatePrompt)

      expect(result).toBe("测试结果")
    })
  })
})
