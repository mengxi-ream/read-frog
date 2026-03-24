import { describe, expect, it } from "vitest"
import {
  getProviderOptions,
  getProviderOptionsWithOverride,
  getRecommendedProviderOptionsMatch,
} from "../../providers/options"
import { LLM_PROVIDER_MODELS } from "../models"

describe("getProviderOptions", () => {
  describe("model pattern matching", () => {
    it("should return options for gemini models", () => {
      const options = getProviderOptions("gemini-2.5-pro", "google")
      expect(options.google).toBeDefined()
      expect(options.google?.thinkingConfig).toMatchObject({ thinkingBudget: 0, includeThoughts: false })
    })

    it("should handle thinking models correctly", () => {
      const thinkingOptions = getProviderOptions("gemini-2.5-pro", "google")
      expect(thinkingOptions.google?.thinkingConfig).toMatchObject({ thinkingBudget: 0 })

      const nonThinkingOptions = getProviderOptions("gemini-2.5-flash", "google")
      expect(nonThinkingOptions.google?.thinkingConfig).toMatchObject({ thinkingBudget: 0 })

      const thinkingLevelFlashOptions = getProviderOptions("gemini-3-flash-preview", "google")
      expect(thinkingLevelFlashOptions.google?.thinkingConfig).toMatchObject({ thinkingLevel: "minimal", includeThoughts: false })

      const thinkingLevelProOptions = getProviderOptions("gemini-3-pro-preview", "google")
      expect(thinkingLevelProOptions.google?.thinkingConfig).toMatchObject({ thinkingLevel: "minimal", includeThoughts: false })

      const thinkingLevel31ProOptions = getProviderOptions("gemini-3.1-pro-preview", "google")
      expect(thinkingLevel31ProOptions.google?.thinkingConfig).toMatchObject({ thinkingLevel: "minimal", includeThoughts: false })
    })

    it("should return options for claude models", () => {
      const options = getProviderOptions("claude-3-5-sonnet", "anthropic")
      expect(options.anthropic).toBeDefined()
      expect(options.anthropic?.thinking).toEqual({ type: "disabled" })
    })

    it("should return options for OpenAI o1/o3/o4 reasoning models", () => {
      const o1Options = getProviderOptions("o1-preview", "openai")
      expect(o1Options.openai?.reasoningEffort).toBe("minimal")

      const o3Options = getProviderOptions("o3-mini", "openai")
      expect(o3Options.openai?.reasoningEffort).toBe("minimal")

      const o4MiniOptions = getProviderOptions("o4-mini", "openai")
      expect(o4MiniOptions.openai?.reasoningEffort).toBe("minimal")
    })

    it("should expose the supported OpenAI GPT-5.4 model ids", () => {
      expect(LLM_PROVIDER_MODELS.openai).toEqual(expect.arrayContaining([
        "gpt-5.4-pro",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-nano",
        "gpt-5.3-chat-latest",
      ]))
    })

    it("should return the documented floor for GPT-5 model-specific reasoning", () => {
      const gpt54ProOptions = getProviderOptions("gpt-5.4-pro", "openai")
      expect(gpt54ProOptions.openai?.reasoningEffort).toBe("medium")

      const gpt52ProOptions = getProviderOptions("gpt-5.2-pro", "openai")
      expect(gpt52ProOptions.openai?.reasoningEffort).toBe("medium")

      const gpt5ProOptions = getProviderOptions("gpt-5-pro", "openai")
      expect(gpt5ProOptions.openai?.reasoningEffort).toBe("high")

      const gpt54Options = getProviderOptions("gpt-5.4", "openai")
      expect(gpt54Options.openai?.reasoningEffort).toBe("none")

      const gpt54MiniOptions = getProviderOptions("gpt-5.4-mini", "openai")
      expect(gpt54MiniOptions.openai?.reasoningEffort).toBe("none")

      const gpt54NanoOptions = getProviderOptions("gpt-5.4-nano", "openai")
      expect(gpt54NanoOptions.openai?.reasoningEffort).toBe("none")

      const gpt52Options = getProviderOptions("gpt-5.2", "openai")
      expect(gpt52Options.openai?.reasoningEffort).toBe("none")

      const gpt51Options = getProviderOptions("gpt-5.1", "openai")
      expect(gpt51Options.openai?.reasoningEffort).toBe("none")

      const gpt51CodexOptions = getProviderOptions("gpt-5.1-codex", "openai")
      expect(gpt51CodexOptions.openai?.reasoningEffort).toBe("none")

      const gpt51CodexMiniOptions = getProviderOptions("gpt-5.1-codex-mini", "openai")
      expect(gpt51CodexMiniOptions.openai?.reasoningEffort).toBe("none")
    })

    it("should return minimal for legacy GPT-5 models", () => {
      const gpt5Options = getProviderOptions("gpt-5", "openai")
      expect(gpt5Options.openai?.reasoningEffort).toBe("minimal")

      const gpt5MiniOptions = getProviderOptions("gpt-5-mini", "openai")
      expect(gpt5MiniOptions.openai?.reasoningEffort).toBe("minimal")

      const gpt5NanoOptions = getProviderOptions("gpt-5-nano", "openai")
      expect(gpt5NanoOptions.openai?.reasoningEffort).toBe("minimal")

      const gpt5CodexOptions = getProviderOptions("gpt-5-codex", "openai")
      expect(gpt5CodexOptions.openai?.reasoningEffort).toBe("minimal")
    })

    it("should omit recommendations for GPT-5 chat-latest models", () => {
      expect(getProviderOptions("gpt-5-chat-latest", "openai")).toEqual({})
      expect(getProviderOptions("gpt-5.1-chat-latest", "openai")).toEqual({})
      expect(getProviderOptions("gpt-5.2-chat-latest", "openai")).toEqual({})
      expect(getProviderOptions("gpt-5.3-chat-latest", "openai")).toEqual({})
    })

    it("should return low/disabled defaults for more mainstream reasoning providers", () => {
      const grokOptions = getProviderOptions("grok-4-fast-reasoning", "xai")
      expect(grokOptions.xai?.reasoningEffort).toBe("low")

      const deepseekReasonerOptions = getProviderOptions("deepseek-reasoner", "deepseek")
      expect(deepseekReasonerOptions.deepseek?.thinking).toEqual({ type: "disabled" })

      const cohereReasoningOptions = getProviderOptions("command-a-reasoning-08-2025", "cohere")
      expect(cohereReasoningOptions.cohere?.thinking).toEqual({ type: "disabled" })

      const moonshotOptions = getProviderOptions("kimi-k2.5", "moonshotai")
      expect(moonshotOptions.moonshotai?.thinking).toEqual({ type: "disabled" })
      expect(moonshotOptions.moonshotai?.reasoningHistory).toBe("disabled")

      const fireworksOptions = getProviderOptions("accounts/fireworks/models/kimi-k2p5", "fireworks")
      expect(fireworksOptions.fireworks?.thinking).toEqual({ type: "disabled" })
      expect(fireworksOptions.fireworks?.reasoningHistory).toBe("disabled")

      const alibabaOptions = getProviderOptions("qwen3-max", "alibaba")
      expect(alibabaOptions.alibaba?.enableThinking).toBe(false)
    })

    it("should apply Moonshot defaults to kimi-k2-turbo", () => {
      const options = getProviderOptions("kimi-k2-turbo", "moonshotai")
      expect(options.moonshotai?.thinking).toEqual({ type: "disabled" })
      expect(options.moonshotai?.reasoningHistory).toBe("disabled")
    })

    it("should apply Alibaba defaults to qwen3.5 flash and plus models", () => {
      const flashOptions = getProviderOptions("qwen3.5-flash", "alibaba")
      expect(flashOptions.alibaba?.enableThinking).toBe(false)

      const plusOptions = getProviderOptions("qwen3.5-plus", "alibaba")
      expect(plusOptions.alibaba?.enableThinking).toBe(false)
    })

    it("should return low/default-compatible reasoning settings for gpt-oss models", () => {
      const groqOptions = getProviderOptions("openai/gpt-oss-120b", "groq")
      expect(groqOptions.groq?.reasoningEffort).toBe("none")

      const cerebrasOptions = getProviderOptions("gpt-oss-120b", "cerebras")
      expect(cerebrasOptions.cerebras?.reasoningEffort).toBe("none")
    })

    it("should not apply Alibaba-only enableThinking defaults to non-Alibaba Qwen model names", () => {
      const groqOptions = getProviderOptions("qwen/qwen3-32b", "groq")
      expect(groqOptions).toEqual({})

      const deepinfraOptions = getProviderOptions("Qwen/Qwen2.5-72B-Instruct", "deepinfra")
      expect(deepinfraOptions).toEqual({})
    })

    it("should return empty object for non-matching models", () => {
      const options = getProviderOptions("some-random-model", "openai")
      expect(options).toEqual({})
    })
  })

  describe("glm model pattern matching", () => {
    it("should match GLM-* models (case-insensitive)", () => {
      const uppercase = getProviderOptions("GLM-4-Plus", "openai-compatible")
      expect(uppercase["openai-compatible"].thinking).toEqual({ type: "disabled" })

      const lowercase = getProviderOptions("glm-4-flash", "openai-compatible")
      expect(lowercase["openai-compatible"].thinking).toEqual({ type: "disabled" })

      const mixed = getProviderOptions("GlM-3-Turbo", "tensdaq")
      expect(mixed.tensdaq?.thinking).toEqual({ type: "disabled" })
    })

    it("should only match models starting with GLM-", () => {
      const middle = getProviderOptions("my-glm-model", "openai-compatible")
      expect(middle.openaiCompatible).toBeUndefined()

      const end = getProviderOptions("model-GLM", "openai-compatible")
      expect(end.openaiCompatible).toBeUndefined()
    })
  })

  describe("user provider option overrides", () => {
    it("should treat an explicit empty object as a user override", () => {
      const options = getProviderOptionsWithOverride("qwen3-max", "alibaba", {})
      expect(options).toEqual({ alibaba: {} })
    })

    it("should fall back to recommendations when user options are undefined", () => {
      const options = getProviderOptionsWithOverride("qwen3-max", "alibaba")
      expect(options).toEqual({ alibaba: { enableThinking: false } })
    })

    it("should use user options as-is without merging matched defaults", () => {
      const options = getProviderOptionsWithOverride("qwen3-max", "alibaba", { foo: "bar" })
      expect(options).toEqual({ alibaba: { foo: "bar" } })
    })
  })

  describe("recommendation metadata", () => {
    it("should expose the matched rule index for UI suggestion state", () => {
      const gpt5Match = getRecommendedProviderOptionsMatch("gpt-5-mini")
      const gpt51Match = getRecommendedProviderOptionsMatch("gpt-5.1")

      expect(gpt5Match?.matchIndex).toBeTypeOf("number")
      expect(gpt51Match?.matchIndex).toBeTypeOf("number")
      expect(gpt5Match?.matchIndex).not.toBe(gpt51Match?.matchIndex)
    })

    it("should return undefined for models without recommendations", () => {
      expect(getRecommendedProviderOptionsMatch("plain-model")).toBeUndefined()
    })

    it("should expose recommendation matches for newly covered defaults", () => {
      expect(getRecommendedProviderOptionsMatch("kimi-k2-turbo")?.options).toEqual({
        thinking: { type: "disabled" },
        reasoningHistory: "disabled",
      })

      expect(getRecommendedProviderOptionsMatch("qwen3.5-flash")?.options).toEqual({
        enableThinking: false,
      })
    })
  })
})
