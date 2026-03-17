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
            systemPrompt: "Target {{targetLanguage}} | Title {{webTitle}} | Summary {{webSummary}}",
            prompt: "Translate {{input}} for {{targetLanguage}} with {{webTitle}} / {{webSummary}}",
          },
        ],
      },
    }

    const result = getTranslatePromptFromConfig(config, "English", "Hola", {
      content: {
        title: "Article Title",
        summary: "Article Summary",
      },
    })

    expect(result.systemPrompt).toBe("Target English | Title Article Title | Summary Article Summary")
    expect(result.prompt).toBe("Translate Hola for English with Article Title / Article Summary")
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
      content: {
        title: "Article Title",
        summary: "Article Summary",
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
              systemPrompt: "Use {{targetLanguage}} with {{webTitle}} and {{webSummary}}",
              prompt: "{{input}} => {{targetLanguage}} / {{webTitle}} / {{webSummary}}",
            },
          ],
        },
      },
    })

    const result = await getSubtitlesTranslatePrompt("Japanese", "Hello world", {
      content: {
        title: "Video Title",
        summary: "Video Summary",
      },
    })

    expect(result.systemPrompt).toBe("Use Japanese with Video Title and Video Summary")
    expect(result.prompt).toBe("Hello world => Japanese / Video Title / Video Summary")
  })
})
