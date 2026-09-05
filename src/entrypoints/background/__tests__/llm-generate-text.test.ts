import { beforeEach, describe, expect, it, vi } from "vitest"

const onMessageMock = vi.fn<(...args: any[]) => any>()
const generateTextForProviderRefMock = vi.fn<(...args: any[]) => any>()
const loggerErrorMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

// The local/hosted branch and every model-tuning detail now live in
// background-stream's generateTextForProviderRef; this module is only the
// message adapter over it, so that is the boundary worth mocking.
vi.mock("../background-stream", () => ({
  generateTextForProviderRef: generateTextForProviderRefMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

const localPayload = {
  providerRef: { kind: "local" as const, config: { id: "openai-default" } as never },
  hostedFeature: "languageDetection" as const,
  instructions: "system",
  prompt: "hello world",
}

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  return registration[1] as (message: {
    data: Record<string, unknown>
  }) => Promise<{ text: string }>
}

describe("llm-generate-text", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("returns the generated text for the given provider ref", async () => {
    generateTextForProviderRefMock.mockResolvedValue("eng")

    const { runGenerateTextInBackground } = await import("../llm-generate-text")
    const result = await runGenerateTextInBackground(localPayload)

    expect(generateTextForProviderRefMock).toHaveBeenCalledWith(localPayload)
    expect(result).toEqual({ text: "eng" })
  })

  it("passes a system provider ref through untouched", async () => {
    generateTextForProviderRefMock.mockResolvedValue("cmn")
    const hostedPayload = {
      ...localPayload,
      providerRef: {
        kind: "system" as const,
        providerId: "read-frog-advance-ai" as const,
        modelTier: "advance" as const,
        modelRevision: "advance-r1",
      },
      requestId: "123e4567-e89b-42d3-a456-426614174000",
    }

    const { setupLLMGenerateTextMessageHandlers } = await import("../llm-generate-text")
    setupLLMGenerateTextMessageHandlers()

    const handler = getRegisteredMessageHandler("backgroundGenerateText")
    await expect(handler({ data: hostedPayload })).resolves.toEqual({ text: "cmn" })
    expect(generateTextForProviderRefMock).toHaveBeenCalledWith(hostedPayload)
  })

  it("logs and rethrows handler errors", async () => {
    generateTextForProviderRefMock.mockRejectedValue(new Error("provider unavailable"))

    const { setupLLMGenerateTextMessageHandlers } = await import("../llm-generate-text")
    setupLLMGenerateTextMessageHandlers()
    const handler = getRegisteredMessageHandler("backgroundGenerateText")

    await expect(handler({ data: localPayload })).rejects.toThrow("provider unavailable")
    expect(loggerErrorMock).toHaveBeenCalled()
  })

  it.each([undefined, null, "", "unknownFeature", "toString"])(
    "rejects an invalid hosted feature (%s) before generating text",
    async (hostedFeature) => {
      const { setupLLMGenerateTextMessageHandlers } = await import("../llm-generate-text")
      setupLLMGenerateTextMessageHandlers()
      const handler = getRegisteredMessageHandler("backgroundGenerateText")
      await expect(
        handler({
          data: {
            ...localPayload,
            providerRef: {
              kind: "system",
              providerId: "read-frog-free-ai",
              modelTier: "normal",
              modelRevision: "r1",
            },
            hostedFeature,
          },
        }),
      ).rejects.toThrow("valid hostedFeature is required")
      expect(generateTextForProviderRefMock).not.toHaveBeenCalled()
    },
  )

  it("allows local generation without a hosted feature", async () => {
    const { hostedFeature: _hostedFeature, ...payload } = localPayload
    generateTextForProviderRefMock.mockResolvedValue("local text")
    const { runGenerateTextInBackground } = await import("../llm-generate-text")
    await expect(runGenerateTextInBackground(payload)).resolves.toEqual({ text: "local text" })
  })
})
