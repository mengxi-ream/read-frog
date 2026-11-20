import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import {
  BUILT_IN_AI_FEATURE_PROVIDER,
  classifyProviderConfig,
  classifyResolvedProvider,
  classifySerializedProvider,
  EDGE_TTS_FEATURE_PROVIDER,
  normalizeFeatureProviderAnalytics,
  UNKNOWN_FEATURE_PROVIDER,
} from "@/utils/analytics-provider"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"

const openAIProvider = {
  id: "openai-provider-id",
  name: "Private provider name",
  enabled: true,
  provider: "openai",
  model: {
    model: "gpt-5.4-mini",
    isCustomModel: false,
    customModel: null,
  },
} satisfies ProviderConfig

const googleTranslateProvider = {
  id: "google-translate-provider-id",
  name: "Another private provider name",
  enabled: true,
  provider: "google-translate",
} satisfies ProviderConfig

describe("feature provider analytics", () => {
  it("classifies configured LLM providers using only their canonical provider type", () => {
    expect(classifyProviderConfig(openAIProvider)).toEqual({
      provider: "openai",
      backend_kind: "llm",
    })
  })

  it("classifies standard translation providers as non-LLM", () => {
    expect(classifyProviderConfig(googleTranslateProvider)).toEqual({
      provider: "google-translate",
      backend_kind: "non_llm",
    })
  })

  it("maps a Built-in AI model to the analytics-only name, recording the model", () => {
    expect(
      classifyResolvedProvider({
        kind: "system",
        id: DEFAULT_BUILT_IN_AI_PROVIDER_ID,
        name: "GPT-6 Luna",
        model: "gpt-6-luna",
      }),
    ).toEqual({ ...BUILT_IN_AI_FEATURE_PROVIDER, built_in_ai_model: "gpt-6-luna" })
    expect(BUILT_IN_AI_FEATURE_PROVIDER).toEqual({
      provider: "read-frog-built-in-ai",
      backend_kind: "llm",
    })
  })

  it("classifies a serialized ref the same way, reading the id a transport keeps", () => {
    expect(
      classifySerializedProvider({
        kind: "system",
        providerId: DEFAULT_BUILT_IN_AI_PROVIDER_ID,
        model: "gpt-6-luna",
        modelTier: "normal",
        modelRevision: "rev-1",
        reasoning: null,
      }),
    ).toEqual({ ...BUILT_IN_AI_FEATURE_PROVIDER, built_in_ai_model: "gpt-6-luna" })
    expect(classifySerializedProvider({ kind: "local", config: googleTranslateProvider })).toEqual({
      provider: "google-translate",
      backend_kind: "non_llm",
    })
    expect(classifySerializedProvider(undefined)).toEqual(UNKNOWN_FEATURE_PROVIDER)
  })

  it("classifies Edge TTS as a non-LLM backend", () => {
    expect(EDGE_TTS_FEATURE_PROVIDER).toEqual({
      provider: "edge-tts",
      backend_kind: "non_llm",
    })
  })

  it("uses unknown/unknown for missing providers and invalid runtime combinations", () => {
    expect(classifyProviderConfig(null)).toEqual(UNKNOWN_FEATURE_PROVIDER)
    expect(classifyResolvedProvider(undefined)).toEqual(UNKNOWN_FEATURE_PROVIDER)
    expect(normalizeFeatureProviderAnalytics("openai", "non_llm")).toEqual(UNKNOWN_FEATURE_PROVIDER)
    expect(normalizeFeatureProviderAnalytics("not-a-provider", "llm")).toEqual(
      UNKNOWN_FEATURE_PROVIDER,
    )
  })

  it("keeps a Built-in AI event's model when it is a model id, and only then", () => {
    expect(normalizeFeatureProviderAnalytics("read-frog-built-in-ai", "llm", "gpt-6-luna")).toEqual(
      { ...BUILT_IN_AI_FEATURE_PROVIDER, built_in_ai_model: "gpt-6-luna" },
    )
    // From a content script that predates models.
    expect(normalizeFeatureProviderAnalytics("read-frog-built-in-ai", "llm")).toEqual(
      BUILT_IN_AI_FEATURE_PROVIDER,
    )
    expect(
      normalizeFeatureProviderAnalytics("read-frog-built-in-ai", "llm", "x".repeat(65)),
    ).toEqual(BUILT_IN_AI_FEATURE_PROVIDER)
    expect(normalizeFeatureProviderAnalytics("read-frog-built-in-ai", "llm", 42)).toEqual(
      BUILT_IN_AI_FEATURE_PROVIDER,
    )
    // A model rides only on Built-in AI.
    expect(normalizeFeatureProviderAnalytics("google-translate", "non_llm", "gpt-6-luna")).toEqual({
      provider: "google-translate",
      backend_kind: "non_llm",
    })
  })
})
