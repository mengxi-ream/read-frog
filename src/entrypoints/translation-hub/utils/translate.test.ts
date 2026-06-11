import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { translateForTranslationHub } from "./translate"

const streamBackgroundTextMock = vi.hoisted(() => vi.fn())
const executeTranslateMock = vi.hoisted(() => vi.fn())

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundText: streamBackgroundTextMock,
}))

vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: executeTranslateMock,
}))

vi.mock("@/utils/providers/model-id", () => ({
  resolveModelId: vi.fn(() => "gpt-test"),
}))

vi.mock("@/utils/providers/options", () => ({
  getProviderOptionsWithOverride: vi.fn(() => ({ openai: { reasoningEffort: "low" } })),
}))

const languageConfig: Config["language"] = {
  sourceCode: "cmn",
  targetCode: "eng",
  level: "intermediate",
}

function getDefaultOpenAIProvider() {
  const provider = DEFAULT_CONFIG.providersConfig.find(
    (item): item is LLMProviderConfig => item.provider === "openai",
  )
  if (!provider)
    throw new Error("Expected DEFAULT_CONFIG to include an OpenAI provider")
  return provider
}

function getDefaultMicrosoftProvider() {
  const provider = DEFAULT_CONFIG.providersConfig.find(
    (item): item is TranslateProviderConfig => item.provider === "microsoft-translate",
  )
  if (!provider)
    throw new Error("Expected DEFAULT_CONFIG to include a Microsoft translate provider")
  return provider
}

const translateConfig = DEFAULT_CONFIG.translate
const llmProviderConfig = getDefaultOpenAIProvider()
const microsoftProviderConfig = getDefaultMicrosoftProvider()

describe("translateForTranslationHub", () => {
  it("streams LLM translation chunks through background stream text", async () => {
    streamBackgroundTextMock.mockReset()
    executeTranslateMock.mockReset()
    streamBackgroundTextMock.mockImplementationOnce(async (
      _payload: unknown,
      options: { onChunk?: (data: BackgroundTextStreamSnapshot) => void },
    ) => {
      options.onChunk?.({
        output: "Hel",
        thinking: { status: "thinking", text: "" },
      })
      options.onChunk?.({
        output: "Hello",
        thinking: { status: "complete", text: "" },
      })

      return {
        output: "Hello",
        thinking: { status: "complete", text: "" },
      }
    })

    const chunks: string[] = []
    const result = await translateForTranslationHub(
      "hello",
      languageConfig,
      llmProviderConfig,
      translateConfig,
      {
        onChunk: data => chunks.push(data.output),
      },
    )

    expect(result).toBe("Hello")
    expect(chunks).toEqual(["Hel", "Hello"])
    expect(streamBackgroundTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: llmProviderConfig.id,
        prompt: expect.stringContaining("hello"),
        providerOptions: { openai: { reasoningEffort: "low" } },
        temperature: llmProviderConfig.temperature,
      }),
      expect.objectContaining({
        onChunk: expect.any(Function),
      }),
    )
    expect(executeTranslateMock).not.toHaveBeenCalled()
  })

  it("keeps standard translate providers on executeTranslate", async () => {
    streamBackgroundTextMock.mockReset()
    executeTranslateMock.mockReset()
    executeTranslateMock.mockResolvedValueOnce("Bonjour")

    const result = await translateForTranslationHub(
      "hello",
      languageConfig,
      microsoftProviderConfig,
      translateConfig,
    )

    expect(result).toBe("Bonjour")
    expect(executeTranslateMock).toHaveBeenCalledWith(
      "hello",
      languageConfig,
      microsoftProviderConfig,
      expect.any(Function),
    )
    expect(streamBackgroundTextMock).not.toHaveBeenCalled()
  })
})
