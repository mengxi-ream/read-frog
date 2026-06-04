import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildBilingualRenderCacheKey,
  clearBilingualRenderCache,
  getCachedBilingualTranslation,
  MAX_BILINGUAL_RENDER_CACHE_SIZE,
  setCachedBilingualTranslation,
} from "../translation-render-cache"

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    language: {
      ...DEFAULT_CONFIG.language,
      ...overrides.language,
    },
    translate: {
      ...DEFAULT_CONFIG.translate,
      ...overrides.translate,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        ...overrides.translate?.page,
      },
      translationNodeStyle: {
        ...DEFAULT_CONFIG.translate.translationNodeStyle,
        ...overrides.translate?.translationNodeStyle,
      },
      customPromptsConfig: {
        ...DEFAULT_CONFIG.translate.customPromptsConfig,
        ...overrides.translate?.customPromptsConfig,
      },
    },
  }
}

describe("translation-render-cache", () => {
  it("builds the same key for normalized source text", () => {
    const config = createConfig()
    const keyWithWhitespace = buildBilingualRenderCacheKey("  hello\u200B  ", config)
    const keyWithoutWhitespace = buildBilingualRenderCacheKey("hello", config)

    expect(keyWithWhitespace).toBe(keyWithoutWhitespace)
  })

  it("changes cache key when target language changes", () => {
    const config = createConfig()
    const englishTargetKey = buildBilingualRenderCacheKey("hello", config)
    const japaneseTargetKey = buildBilingualRenderCacheKey("hello", createConfig({
      language: { ...DEFAULT_CONFIG.language, targetCode: "jpn" },
    }))

    expect(englishTargetKey).not.toBe(japaneseTargetKey)
  })

  it("changes cache key when provider, mode, or style changes", () => {
    const baseConfig = createConfig()
    const baseKey = buildBilingualRenderCacheKey("hello", baseConfig)

    expect(buildBilingualRenderCacheKey("hello", createConfig({
      translate: { ...DEFAULT_CONFIG.translate, providerId: "openai-default" },
    }))).not.toBe(baseKey)

    expect(buildBilingualRenderCacheKey("hello", createConfig({
      translate: { ...DEFAULT_CONFIG.translate, mode: "translationOnly" },
    }))).not.toBe(baseKey)

    expect(buildBilingualRenderCacheKey("hello", createConfig({
      translate: {
        ...DEFAULT_CONFIG.translate,
        translationNodeStyle: {
          ...DEFAULT_CONFIG.translate.translationNodeStyle,
          preset: "blur",
        },
      },
    }))).not.toBe(baseKey)
  })

  it("changes cache key when page skip settings change", () => {
    const baseConfig = createConfig()
    const baseKey = buildBilingualRenderCacheKey("hello", baseConfig)

    expect(buildBilingualRenderCacheKey("hello", createConfig({
      translate: {
        ...DEFAULT_CONFIG.translate,
        page: {
          ...DEFAULT_CONFIG.translate.page,
          enableTargetLanguageSkip: false,
        },
      },
    }))).not.toBe(baseKey)

    expect(buildBilingualRenderCacheKey("hello", createConfig({
      translate: {
        ...DEFAULT_CONFIG.translate,
        page: {
          ...DEFAULT_CONFIG.translate.page,
          skipLanguages: ["eng"],
        },
      },
    }))).not.toBe(baseKey)
  })

  it("changes cache key when language detection settings change", () => {
    const baseConfig = createConfig()
    const baseKey = buildBilingualRenderCacheKey("hello", baseConfig)

    expect(buildBilingualRenderCacheKey("hello", createConfig({
      languageDetection: {
        mode: "llm",
        providerId: "openai-default",
      },
    }))).not.toBe(baseKey)
  })

  it("changes cache key when LLM language detector provider config changes", () => {
    const llmDetectionConfig = createConfig({
      languageDetection: {
        mode: "llm",
        providerId: "openai-default",
      },
    })
    const baseKey = buildBilingualRenderCacheKey("hello", llmDetectionConfig)
    const changedDetectorConfig = createConfig({
      languageDetection: {
        mode: "llm",
        providerId: "openai-default",
      },
      providersConfig: DEFAULT_CONFIG.providersConfig.map(provider =>
        provider.id === "openai-default"
          ? { ...provider, temperature: 0.7 }
          : provider,
      ),
    })

    expect(buildBilingualRenderCacheKey("hello", changedDetectorConfig)).not.toBe(baseKey)
  })

  it("separates LLM provider cache entries by page context (url)", () => {
    const llmConfig = createConfig({
      translate: { ...DEFAULT_CONFIG.translate, providerId: "openai-default" },
    })

    const pageAKey = buildBilingualRenderCacheKey("hello", llmConfig, "https://example.com/a")
    const pageBKey = buildBilingualRenderCacheKey("hello", llmConfig, "https://example.com/b")
    const pageADuplicateKey = buildBilingualRenderCacheKey("hello", llmConfig, "https://example.com/a")

    // Different pages can yield different LLM translations (page title/summary is
    // injected into the prompt), so their cache entries must not collide.
    expect(pageAKey).not.toBe(pageBKey)
    // Same page must reuse the same cache entry.
    expect(pageAKey).toBe(pageADuplicateKey)
  })

  it("ignores page context for non-LLM providers so entries stay shareable across pages", () => {
    // DEFAULT_CONFIG uses microsoft-translate-default (a non-LLM provider).
    const nonLLMConfig = createConfig()

    const pageAKey = buildBilingualRenderCacheKey("hello", nonLLMConfig, "https://example.com/a")
    const pageBKey = buildBilingualRenderCacheKey("hello", nonLLMConfig, "https://example.com/b")

    expect(pageAKey).toBe(pageBKey)
  })

  it("evicts the oldest entry when the cache exceeds its max size", () => {
    clearBilingualRenderCache()

    for (let index = 0; index < MAX_BILINGUAL_RENDER_CACHE_SIZE; index++) {
      setCachedBilingualTranslation(`key-${index}`, `translation-${index}`)
    }

    setCachedBilingualTranslation("key-new", "translation-new")

    expect(getCachedBilingualTranslation("key-0")).toBeUndefined()
    expect(getCachedBilingualTranslation("key-1")).toBe("translation-1")
    expect(getCachedBilingualTranslation("key-new")).toBe("translation-new")

    clearBilingualRenderCache()
  })
})
