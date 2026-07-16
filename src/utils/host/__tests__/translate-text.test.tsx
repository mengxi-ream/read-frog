// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"
import { detectLanguage } from "@/utils/content/language"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import {
  translateTextForInput,
  translateTextForPage,
  translateTextForPageTitle,
} from "@/utils/host/translate/translate-variants"
import { getTranslatePrompt } from "@/utils/prompts/translate"

// Mock dependencies
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/api/microsoft", () => ({
  microsoftTranslate: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/api/google", () => ({
  googleTranslate: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/api/deepl", () => ({
  deeplTranslate: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/api/deeplx", () => ({
  deeplxTranslate: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/prompts/translate", () => ({
  getTranslatePrompt: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/content/language", () => ({
  detectLanguage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/webpage-summary", () => ({
  getOrGenerateWebPageSummary: vi.fn<(...args: any[]) => any>(),
}))

let mockSendMessage: any
let mockMicrosoftTranslate: any
let mockGoogleTranslate: any
let mockDeepLTranslate: any
let mockDeepLXTranslate: any
let mockGetConfigFromStorage: any
let mockGetTranslatePrompt: any
let mockGetOrCreateWebPageContext: any
let mockGetOrGenerateWebPageSummary: any
let mockDetectLanguage: any

describe("translate-text", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    document.title = "Document Title"
    document.body.innerHTML = "<main>Body content</main>"
    mockSendMessage = vi.mocked((await import("@/utils/message")).sendMessage)
    mockMicrosoftTranslate = vi.mocked(
      (await import("@/utils/host/translate/api/microsoft")).microsoftTranslate,
    )
    mockGoogleTranslate = vi.mocked(
      (await import("@/utils/host/translate/api/google")).googleTranslate,
    )
    mockDeepLTranslate = vi.mocked(
      (await import("@/utils/host/translate/api/deepl")).deeplTranslate,
    )
    mockDeepLXTranslate = vi.mocked(
      (await import("@/utils/host/translate/api/deeplx")).deeplxTranslate,
    )
    mockGetConfigFromStorage = vi.mocked((await import("@/utils/config/storage")).getLocalConfig)
    mockGetTranslatePrompt = vi.mocked(
      (await import("@/utils/prompts/translate")).getTranslatePrompt,
    )
    mockGetOrCreateWebPageContext = vi.mocked(
      (await import("@/utils/host/translate/webpage-context")).getOrCreateWebPageContext,
    )
    mockGetOrGenerateWebPageSummary = vi.mocked(
      (await import("@/utils/host/translate/webpage-summary")).getOrGenerateWebPageSummary,
    )
    mockDetectLanguage = vi.mocked(detectLanguage)

    // Mock getOrCreateWebPageContext to return stable webpage metadata
    mockGetOrCreateWebPageContext.mockImplementation(() =>
      Promise.resolve({
        url: window.location.href,
        webTitle: document.title,
        webContent: document.body.textContent || "",
      }),
    )
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
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: "test text",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: expect.any(Object),
          scheduleAt: expect.any(Number),
          hash: expect.any(String),
        }),
      )
      expect(mockGetOrCreateWebPageContext).not.toHaveBeenCalled()
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
    })

    it("maps a full no-translation sentinel response to an empty string", async () => {
      mockSendMessage.mockResolvedValue(NO_TRANSLATION_SENTINEL)

      const result = await translateTextForPage("test text")

      expect(result).toBe("")
      expect(mockSendMessage).toHaveBeenCalledOnce()
    })

    it("returns a response containing the sentinel inside longer text verbatim", async () => {
      const mixed = `some translation ${NO_TRANSLATION_SENTINEL}`
      mockSendMessage.mockResolvedValue(mixed)

      const result = await translateTextForPage("test text")

      expect(result).toBe(mixed)
    })

    it("skips target-language text before sending a translation request by default", async () => {
      mockDetectLanguage.mockResolvedValueOnce(DEFAULT_CONFIG.language.targetCode)

      const targetLanguageText =
        "这是一个已经使用目标语言写成的较长段落，用于触发翻译前目标语言检测并跳过请求，同时确保文本长度超过检测阈值。"
      const result = await translateTextForPage(targetLanguageText)

      expect(result).toBe("")
      expect(mockDetectLanguage).toHaveBeenCalledWith(targetLanguageText, {
        enableLLM: false,
      })
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it("sends the translation request when target-language precheck is disabled", async () => {
      const config = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          page: {
            ...DEFAULT_CONFIG.translate.page,
            enableTargetLanguageSkip: false,
          },
        },
      }
      mockGetConfigFromStorage.mockResolvedValue(config)
      mockSendMessage.mockResolvedValue("translated text")

      const targetLanguageText =
        "这是一个已经使用目标语言写成的较长段落，但关闭预检测后仍然应该发送翻译请求，同时确保文本长度超过检测阈值。"
      const result = await translateTextForPage(targetLanguageText)

      expect(result).toBe("translated text")
      expect(mockDetectLanguage).not.toHaveBeenCalled()
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: targetLanguageText,
        }),
      )
    })

    it("keeps explicit skipLanguages behavior when target-language precheck is disabled", async () => {
      const config = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          page: {
            ...DEFAULT_CONFIG.translate.page,
            enableTargetLanguageSkip: false,
            skipLanguages: ["jpn"],
          },
        },
      }
      mockGetConfigFromStorage.mockResolvedValue(config)
      mockDetectLanguage.mockResolvedValueOnce("jpn")

      const japaneseText =
        "これは日本語で書かれた十分に長い段落で、明示的なスキップ言語の設定によって翻訳前にスキップされます。"
      const result = await translateTextForPage(japaneseText)

      expect(result).toBe("")
      expect(mockDetectLanguage).toHaveBeenCalledWith(japaneseText, {
        minLength: 10,
        enableLLM: false,
      })
      expect(mockSendMessage).not.toHaveBeenCalled()
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
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: "Source Title To Translate",
          webTitle: "Source Title To Translate",
          webContent: undefined,
        }),
      )
      expect(mockGetOrCreateWebPageContext).not.toHaveBeenCalled()
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
    })

    it("should include webpage content for AI-aware title translation", async () => {
      const llmConfig = {
        ...DEFAULT_CONFIG,
        translate: {
          ...DEFAULT_CONFIG.translate,
          providerId: "openai-default",
          enableAIContentAware: true,
        },
      }

      mockGetConfigFromStorage.mockResolvedValue(llmConfig)
      mockSendMessage.mockImplementation(async (type: string) => {
        if (type === "enqueueTranslateRequest") {
          return "translated page title"
        }
        return undefined
      })

      const result = await translateTextForPageTitle("Source Title To Translate")

      expect(result).toBe("translated page title")
      expect(mockGetOrCreateWebPageContext).toHaveBeenCalledTimes(1)
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: "Source Title To Translate",
          webTitle: "Source Title To Translate",
          webContent: "Body content",
          webSummary: undefined,
        }),
      )
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
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: "Body text",
          webTitle: "Translated Browser Title",
        }),
      )
    })
  })

  describe("translateTextForInput", () => {
    it("skips webpage context loading for non-llm input translations", async () => {
      mockSendMessage.mockResolvedValue("translated input")

      const result = await translateTextForInput("hello", "eng", "cmn")

      expect(result).toBe("translated input")
      expect(mockGetOrCreateWebPageContext).not.toHaveBeenCalled()
      expect(mockGetOrGenerateWebPageSummary).not.toHaveBeenCalled()
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: "hello",
          webTitle: undefined,
          webContent: undefined,
          webSummary: undefined,
        }),
      )
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
      expect(mockSendMessage).toHaveBeenCalledWith(
        "enqueueTranslateRequest",
        expect.objectContaining({
          text: "hello",
          webTitle: "Document Title",
          webContent: "Body content",
          webSummary: "Generated summary",
        }),
      )
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
      expect(await executeTranslate(" \n ", langConfig, providerConfig, getTranslatePrompt)).toBe(
        "",
      )
      expect(await executeTranslate(" \n \t", langConfig, providerConfig, getTranslatePrompt)).toBe(
        "",
      )
    })

    it("should handle zero-width spaces correctly", async () => {
      // Only zero-width spaces should return empty
      expect(
        await executeTranslate("\u200B\u200B", langConfig, providerConfig, getTranslatePrompt),
      ).toBe("")

      // Mixed invisible + whitespace should return empty
      expect(
        await executeTranslate("\u200B \u200B", langConfig, providerConfig, getTranslatePrompt),
      ).toBe("")

      // Should translate valid content after removing zero-width spaces
      mockMicrosoftTranslate.mockResolvedValue("你好")
      const result = await executeTranslate(
        "\u200B hello \u200B",
        langConfig,
        providerConfig,
        getTranslatePrompt,
      )
      expect(result).toBe("你好")
      // Shared translation core should send minimally prepared text to the provider
      expect(mockMicrosoftTranslate).toHaveBeenCalledWith("hello", "en", "zh", {
        textFormat: undefined,
      })
    })

    it("should trim translation result", async () => {
      mockMicrosoftTranslate.mockResolvedValue("  测试结果  ")

      const result = await executeTranslate(
        "test input",
        langConfig,
        providerConfig,
        getTranslatePrompt,
      )

      expect(result).toBe("测试结果")
    })

    it("should decode Google translateHtml entities", async () => {
      const googleProviderConfig = {
        id: "google-translate-default",
        enabled: true,
        name: "Google Translate",
        provider: "google-translate" as const,
      }
      mockGoogleTranslate.mockResolvedValue(
        " L&#39;Iran chiama &quot;Dichiarazione&quot; AT&amp;T &lt;span&gt; ",
      )

      const result = await executeTranslate(
        "test input",
        langConfig,
        googleProviderConfig,
        getTranslatePrompt,
      )

      expect(result).toBe('L\'Iran chiama "Dichiarazione" AT&T <span>')
      expect(mockGoogleTranslate).toHaveBeenCalledWith("test input", "en", "zh", {
        textFormat: undefined,
      })
    })

    it("forwards html text format to DeepL", async () => {
      const deeplProviderConfig = {
        id: "deepl-default",
        enabled: true,
        name: "DeepL",
        provider: "deepl" as const,
        apiKey: "test-key",
      }
      const html = '<p class="message">Hello</p>'
      mockDeepLTranslate.mockResolvedValue("<p>你好</p>")

      await executeTranslate(html, langConfig, deeplProviderConfig, getTranslatePrompt, {
        textFormat: "html",
      })

      expect(mockDeepLTranslate).toHaveBeenCalledWith(html, "en", "zh", deeplProviderConfig, {
        textFormat: "html",
      })
    })

    it("forwards html text format to DeepLX", async () => {
      const deeplxProviderConfig = {
        id: "deeplx-default",
        enabled: true,
        name: "DeepLX",
        provider: "deeplx" as const,
        apiKey: "test-key",
        baseURL: "https://api.deeplx.org/{{apiKey}}/translate",
      }
      const html = '<p class="message">Hello</p>'
      mockDeepLXTranslate.mockResolvedValue("<p>你好</p>")

      await executeTranslate(html, langConfig, deeplxProviderConfig, getTranslatePrompt, {
        textFormat: "html",
      })

      expect(mockDeepLXTranslate).toHaveBeenCalledWith(html, "en", "zh", deeplxProviderConfig, {
        textFormat: "html",
      })
    })
  })
})
