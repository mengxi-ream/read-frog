import type { LLMProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getRequestErrorMeta } from "@/utils/request/retry-policy"
import { aiTranslate } from "../ai"

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getModelById: vi.fn(),
  resolveModelId: vi.fn(),
  getProviderOptionsWithOverride: vi.fn(),
}))

vi.mock("ai", () => ({
  generateText: mocks.generateText,
}))

vi.mock("@/utils/providers/model", () => ({
  getModelById: mocks.getModelById,
}))

vi.mock("@/utils/providers/model-id", () => ({
  resolveModelId: mocks.resolveModelId,
}))

vi.mock("@/utils/providers/options", () => ({
  getProviderOptionsWithOverride: mocks.getProviderOptionsWithOverride,
}))

const providerConfig: LLMProviderConfig = {
  id: "openai-default",
  name: "OpenAI",
  provider: "openai",
  enabled: true,
  apiKey: "sk-test",
  model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
}

const promptResolver = vi.fn().mockResolvedValue({
  systemPrompt: "system",
  prompt: "prompt",
})

describe("aiTranslate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getModelById.mockResolvedValue("model")
    mocks.resolveModelId.mockReturnValue("gpt-5-mini")
    mocks.getProviderOptionsWithOverride.mockReturnValue({})
  })

  it("preserves AI SDK error metadata for retry policy decisions", async () => {
    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
      isRetryable: true,
      responseHeaders: {
        "retry-after": "2",
      },
    })
    mocks.generateText.mockRejectedValue(rateLimitedError)

    const error = await aiTranslate("hello", "Chinese", providerConfig, promptResolver).catch(error => error)

    expect(error).toBe(rateLimitedError)
    expect(getRequestErrorMeta(error)).toEqual(expect.objectContaining({
      statusCode: 429,
      isRetryable: true,
      retryAfterMs: 2000,
      kind: "rate-limit",
    }))
  })

  it("preserves response body as the display message when the AI SDK message is generic", async () => {
    const responseBody = "{\"code\":404,\"message\":\"模型 Kimi-K2-Instruct-09051 无效\",\"data\":{}}"
    const invalidModelError = Object.assign(new Error("Something went wrong"), {
      statusCode: 404,
      isRetryable: false,
      responseBody,
    })
    mocks.generateText.mockRejectedValue(invalidModelError)

    const error = await aiTranslate("hello", "Chinese", providerConfig, promptResolver).catch(error => error)

    expect(error).toBe(invalidModelError)
    expect(error.message).toBe(responseBody)
    expect(getRequestErrorMeta(error)).toEqual(expect.objectContaining({
      statusCode: 404,
      isRetryable: false,
      kind: "bad-request",
    }))
  })
})
