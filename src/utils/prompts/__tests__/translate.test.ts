import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getSubtitlesTranslatePrompt } from "../subtitles"
import { getTranslatePromptFromConfig } from "../translate"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn(),
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
            systemPrompt: "Target {{targetLanguage}} | Title {{webTitle}} | Description {{webDescription}} | Content {{webContent}} | Summary {{webSummary}}",
            prompt: "Translate {{input}} for {{targetLanguage}} with {{webTitle}} / {{webDescription}} / {{webContent}} / {{webSummary}}",
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

    expect(result.systemPrompt).toBe("Target English | Title Article Title | Description Article Description | Content Article Content | Summary Article Summary")
    expect(result.prompt).toBe("Translate Hola for English with Article Title / Article Description / Article Content / Article Summary")
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
              systemPrompt: "Use {{targetLanguage}} with {{webTitle}}, {{webDescription}}, and {{videoSummary}}",
              prompt: "{{input}} => {{targetLanguage}} / {{webTitle}} / {{webDescription}} / {{videoSummary}}",
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

    expect(result.systemPrompt).toBe("Use Japanese with Video Title, Video Description, and Video Summary")
    expect(result.prompt).toBe("Hello world => Japanese / Video Title / Video Description / Video Summary")
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
