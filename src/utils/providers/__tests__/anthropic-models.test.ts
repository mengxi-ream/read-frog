import type { AISDKReasoning } from "@/types/config/provider"
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { createAnthropic } from "@ai-sdk/anthropic"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { buildLocalGenerateTextParams } from "../generate-params"

const prompt = [
  { role: "user" as const, content: [{ type: "text" as const, text: "Translate hello" }] },
]

interface AnthropicRequest {
  thinking?: { type: string }
  output_config?: { effort?: string }
  max_tokens: number
}

async function getAnthropicRequest(
  model: "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5" | "claude-fable-5-1",
  reasoning: AISDKReasoning | undefined,
  providerOptions?: Record<string, unknown>,
) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({
      id: "test-message",
      type: "message",
      role: "assistant",
      model,
      content: [{ type: "text", text: "你好" }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 2 },
    }),
  )
  const provider = createAnthropic({
    apiKey: "test-key",
    fetch: fetchMock,
  })
  const params = buildLocalGenerateTextParams({
    ...DEFAULT_PROVIDER_CONFIG.anthropic,
    model: { model, isCustomModel: false, customModel: null },
    reasoning,
    providerOptions,
  })
  await provider.languageModel(model).doGenerate({ prompt, ...params })
  return JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as AnthropicRequest
}

describe("Claude 5.5 request compatibility", () => {
  it.each([
    ["claude-haiku-5-5", { type: "disabled" }, undefined],
    ["claude-sonnet-5-5", { type: "between_tools" }, undefined],
    ["claude-opus-5-5", undefined, "low"],
  ] as const)(
    "uses the supported minimum thinking mode for %s",
    async (model, thinking, effort) => {
      const body = await getAnthropicRequest(model, "none")
      expect(body.thinking).toEqual(thinking)
      expect(body.output_config?.effort).toBe(effort)
      expect(body.max_tokens).toBe(128000)
    },
  )

  it.each(["claude-opus-5-5", "claude-fable-5-1"] as const)(
    "uses low effort for %s when no reasoning setting is saved",
    async (model) => {
      const body = await getAnthropicRequest(model, undefined)
      expect(body.thinking).toBeUndefined()
      expect(body.output_config?.effort).toBe("low")
    },
  )

  it("uses between-tools thinking for Sonnet when no reasoning setting is saved", async () => {
    const body = await getAnthropicRequest("claude-sonnet-5-5", undefined)
    expect(body.thinking).toEqual({ type: "between_tools" })
  })

  it("lets explicit top-level reasoning override the recommended Opus effort", async () => {
    const body = await getAnthropicRequest("claude-opus-5-5", "high")
    expect(body.thinking?.type).toBe("adaptive")
    expect(body.output_config?.effort).toBe("high")
  })

  it("preserves a user-authored effort override", async () => {
    const body = await getAnthropicRequest("claude-opus-5-5", "none", { effort: "high" })
    expect(body.output_config?.effort).toBe("high")
  })

  it.each([
    "anthropic.claude-haiku-5-5",
    "anthropic.claude-sonnet-5-5",
    "anthropic.claude-opus-5-5",
  ] as const)("omits unsupported sampling settings for %s on Bedrock", async (model) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        output: { message: { role: "assistant", content: [{ text: "你好" }] } },
        stopReason: "end_turn",
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        metrics: { latencyMs: 1 },
      }),
    )
    const provider = createAmazonBedrock({
      apiKey: "test-key",
      region: "us-east-1",
      fetch: fetchMock,
    })
    const params = buildLocalGenerateTextParams({
      ...DEFAULT_PROVIDER_CONFIG.bedrock,
      model: { model, isCustomModel: false, customModel: null },
      temperature: 0.2,
    })
    await provider.languageModel(model).doGenerate({ prompt, ...params })
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      inferenceConfig?: { temperature?: number }
    }
    expect(body.inferenceConfig?.temperature).toBeUndefined()
  })
})
