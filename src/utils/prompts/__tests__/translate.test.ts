import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isNoTranslationSentinel, NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"
import { getSubtitlesTranslatePrompt } from "../subtitles"
import { getTranslatePromptFromConfig } from "../translate"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
}))

let mockGetLocalConfig: any

describe("translate prompt tokens", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetLocalConfig = vi.mocked((await import("@/utils/config/storage")).getLocalConfig)
  })

  it("replaces new translate prompt tokens from config", () => {
    const config: Pick<Config["translate"], "customPromptsConfig"> = {
      customPromptsConfig: {
        promptId: "custom-prompt",
        patterns: [
          {
            id: "custom-prompt",
            name: "Custom",
            systemPrompt:
              "Target {{targetLanguage}} | Title {{webTitle}} | Description {{webDescription}} | Content {{webContent}} | Summary {{webSummary}}",
            prompt:
              "Translate {{input}} for {{targetLanguage}} with {{webTitle}} / {{webDescription}} / {{webContent}} / {{webSummary}}",
          },
        ],
      },
    }

    const result = getTranslatePromptFromConfig(config, "English", "Hola", {
      context: {
        webTitle: "Article Title",
        webDescription: "Article Description",
        webContent: "Article Content",
        webSummary: "Article Summary",
      },
    })

    expect(result.systemPrompt).toBe(
      "Target English | Title Article Title | Description Article Description | Content Article Content | Summary Article Summary",
    )
    expect(result.prompt).toBe(
      "Translate Hola for English with Article Title / Article Description / Article Content / Article Summary",
    )
  })

  it("does not replace legacy translate prompt tokens at runtime", () => {
    const config: Pick<Config["translate"], "customPromptsConfig"> = {
      customPromptsConfig: {
        promptId: "legacy-prompt",
        patterns: [
          {
            id: "legacy-prompt",
            name: "Legacy",
            systemPrompt: "Legacy {{targetLang}} {{title}} {{summary}}",
            prompt: "Translate {{input}} to {{targetLang}}",
          },
        ],
      },
    }

    const result = getTranslatePromptFromConfig(config, "English", "Hola", {
      context: {
        webTitle: "Article Title",
        webDescription: "Article Description",
        webSummary: "Article Summary",
      },
    })

    expect(result.systemPrompt).toBe("Legacy {{targetLang}} {{title}} {{summary}}")
    expect(result.prompt).toBe("Translate Hola to {{targetLang}}")
  })

  it("replaces new subtitle prompt tokens from stored config", async () => {
    mockGetLocalConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        customPromptsConfig: {
          promptId: "subtitle-prompt",
          patterns: [
            {
              id: "subtitle-prompt",
              name: "Subtitles",
              systemPrompt:
                "Use {{targetLanguage}} with {{webTitle}}, {{webDescription}}, and {{videoSummary}}",
              prompt:
                "{{input}} => {{targetLanguage}} / {{webTitle}} / {{webDescription}} / {{videoSummary}}",
            },
          ],
        },
      },
    })

    const result = await getSubtitlesTranslatePrompt("Japanese", "Hello world", {
      context: {
        webTitle: "Video Title",
        webDescription: "Video Description",
        videoSummary: "Video Summary",
      },
    })

    expect(result.systemPrompt).toBe(
      "Use Japanese with Video Title, Video Description, and Video Summary",
    )
    expect(result.prompt).toBe(
      "Hello world => Japanese / Video Title / Video Description / Video Summary",
    )
  })

  it("falls back when subtitle prompt context is null or undefined", async () => {
    mockGetLocalConfig.mockResolvedValue(DEFAULT_CONFIG)

    const result = await getSubtitlesTranslatePrompt("Japanese", "Hello world", {
      context: {
        webTitle: null,
        webDescription: undefined,
        videoSummary: undefined,
      },
    })

    expect(result.systemPrompt).toContain("Video title: No title available")
    expect(result.systemPrompt).toContain("Video summary: No summary available")
    expect(result.systemPrompt).not.toContain("Video description:")
  })
})

describe("no-translation sentinel", () => {
  const defaultPromptsConfig: Pick<Config["translate"], "customPromptsConfig"> = {
    customPromptsConfig: { promptId: null, patterns: [] },
  }

  it("appends the sentinel rule to batch prompts with the target language substituted", () => {
    const result = getTranslatePromptFromConfig(defaultPromptsConfig, "Simplified Chinese", "Hi", {
      isBatch: true,
    })

    expect(result.systemPrompt).toContain("Already-translated Input Rule")
    expect(result.systemPrompt).toContain(NO_TRANSLATION_SENTINEL)
    expect(result.systemPrompt).toContain("already entirely written in Simplified Chinese")
    expect(result.systemPrompt).not.toContain("{{targetLanguage}}")
  })

  it("appends the sentinel rule after a custom system prompt in batch mode", () => {
    const config: Pick<Config["translate"], "customPromptsConfig"> = {
      customPromptsConfig: {
        promptId: "custom",
        patterns: [
          { id: "custom", name: "Custom", systemPrompt: "My prompt", prompt: "{{input}}" },
        ],
      },
    }

    const result = getTranslatePromptFromConfig(config, "English", "Hi", { isBatch: true })

    expect(result.systemPrompt).toContain("My prompt")
    expect(result.systemPrompt).toContain(NO_TRANSLATION_SENTINEL)
  })

  it("does not add the sentinel rule to non-batch prompts", () => {
    const result = getTranslatePromptFromConfig(defaultPromptsConfig, "English", "Hi")

    expect(result.systemPrompt).not.toContain(NO_TRANSLATION_SENTINEL)
  })

  it("matches only a full trimmed sentinel segment", () => {
    expect(isNoTranslationSentinel(NO_TRANSLATION_SENTINEL)).toBe(true)
    expect(isNoTranslationSentinel(`  ${NO_TRANSLATION_SENTINEL}\n`)).toBe(true)
    expect(isNoTranslationSentinel(`text ${NO_TRANSLATION_SENTINEL}`)).toBe(false)
    expect(isNoTranslationSentinel("{{NO_TRANSLATION")).toBe(false)
    expect(isNoTranslationSentinel("")).toBe(false)
  })
})
