import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import {
  BUILT_IN_AI_FEATURE_PROVIDER,
  classifyProviderConfig,
  classifyResolvedProvider,
  EDGE_TTS_FEATURE_PROVIDER,
  normalizeFeatureProviderAnalytics,
  UNKNOWN_FEATURE_PROVIDER,
} from "@/utils/analytics-provider"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"

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

  it("maps the persisted built-in provider ID to its analytics-only name", () => {
    expect(
      classifyResolvedProvider({
        kind: "system",
        id: BUILT_IN_AI_PROVIDER_ID,
        name: "Built-in AI",
      }),
    ).toEqual(BUILT_IN_AI_FEATURE_PROVIDER)
    expect(BUILT_IN_AI_FEATURE_PROVIDER).toEqual({
      provider: "read-frog-built-in-ai",
      backend_kind: "llm",
    })
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
})
