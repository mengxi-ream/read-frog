import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  DEFAULT_BUILT_IN_AI_PROVIDER_ID,
  getBuiltInAiProviderId,
} from "@/utils/constants/provider-ids"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { TRANSLATION_BATCH_SIZE } from "@/utils/constants/subtitles"
import { getSubtitlesPassLimits } from "../translator"

const AI_LIMITS = { maxItemsPerBatch: 1, maxCharactersPerBatch: 200 }

function configWithProvider(providerId: string, providersConfig = DEFAULT_CONFIG.providersConfig) {
  return {
    ...DEFAULT_CONFIG,
    providersConfig,
    videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId, batchQueueConfig: AI_LIMITS },
  }
}

describe("subtitles pass limits", () => {
  it("uses the AI batch limits for an LLM provider", () => {
    const openai = DEFAULT_PROVIDER_CONFIG.openai
    expect(getSubtitlesPassLimits(configWithProvider(openai.id, [openai]))).toEqual(AI_LIMITS)
  })

  it("uses the AI batch limits for Built-in AI, whichever model is picked", () => {
    for (const providerId of [
      DEFAULT_BUILT_IN_AI_PROVIDER_ID,
      getBuiltInAiProviderId("claude-sonnet-5-5"),
    ]) {
      expect(getSubtitlesPassLimits(configWithProvider(providerId, []))).toEqual(AI_LIMITS)
    }
  })

  it("keeps the fixed group size for a provider that sends one request per cue", () => {
    const google = DEFAULT_PROVIDER_CONFIG["google-translate"]
    expect(getSubtitlesPassLimits(configWithProvider(google.id, [google]))).toEqual({
      maxItemsPerBatch: TRANSLATION_BATCH_SIZE,
      maxCharactersPerBatch: Number.POSITIVE_INFINITY,
    })
  })
})
