import { beforeEach, describe, expect, it, vi } from "vitest"

const onMessageMock = vi.fn()
const getModelByIdMock = vi.fn()
const generateTextMock = vi.fn()
const loggerErrorMock = vi.fn()

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("@/utils/providers/model", () => ({
  getModelById: getModelByIdMock,
}))

vi.mock("ai", () => ({
  generateText: generateTextMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  return registration[1] as (message: { data: Record<string, unknown> }) => Promise<{ text: string }>
}

describe("llm-generate-text", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("runs generateText with resolved model in background", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    generateTextMock.mockResolvedValue({ text: "eng" })

    const { runGenerateTextInBackground } = await import("../llm-generate-text")
    const result = await runGenerateTextInBackground({
      providerId: "openai-default",
      system: "system",
      prompt: "hello world",
      temperature: 0.2,
      maxRetries: 0,
    })

    expect(getModelByIdMock).toHaveBeenCalledWith("openai-default")
    expect(generateTextMock).toHaveBeenCalledWith({
      model: "mock-model",
      system: "system",
      prompt: "hello world",
      temperature: 0.2,
      maxRetries: 0,
    })
    expect(result).toEqual({ text: "eng" })
  })

  it("registers backgroundGenerateText message handler", async () => {
    getModelByIdMock.mockResolvedValue("mock-model")
    generateTextMock.mockResolvedValue({ text: "cmn" })

    const { setupLLMGenerateTextMessageHandlers } = await import("../llm-generate-text")
    setupLLMGenerateTextMessageHandlers()

    const handler = getRegisteredMessageHandler("backgroundGenerateText")
    const result = await handler({
      data: {
        providerId: "openai-default",
        prompt: "你好",
      },
    })

    expect(result).toEqual({ text: "cmn" })
  })

  it("logs and rethrows handler errors", async () => {
    getModelByIdMock.mockRejectedValue(new Error("provider unavailable"))

    const { setupLLMGenerateTextMessageHandlers } = await import("../llm-generate-text")
    setupLLMGenerateTextMessageHandlers()
    const handler = getRegisteredMessageHandler("backgroundGenerateText")

    await expect(handler({
      data: {
        providerId: "openai-default",
        prompt: "test",
      },
    })).rejects.toThrow("provider unavailable")

    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
