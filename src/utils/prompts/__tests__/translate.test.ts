import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { HTML_ATTRIBUTE_MARKER } from "@/utils/host/translate/html-attribute-markers"
import { getSubtitlesTranslatePrompt } from "../subtitles"
import { getTranslatePromptFromConfig } from "../translate"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<(...args: any[]) => any>(),
}))

let mockGetLocalConfig: any

const defaultTranslatePromptConfig: Pick<Config["translate"], "customPromptsConfig"> = {
  customPromptsConfig: {
    promptId: null,
    patterns: [],
  },
}

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

  it("appends mandatory marker rules to the default system prompt", () => {
    const input = `<span ${HTML_ATTRIBUTE_MARKER}="0">Hello</span>`

    const result = getTranslatePromptFromConfig(defaultTranslatePromptConfig, "Chinese", input)

    expect(result.systemPrompt).toContain("## Protected HTML Marker Rules")
    expect(result.systemPrompt).toContain(
      `preserve every \`${HTML_ATTRIBUTE_MARKER}\` attribute occurrence and its value exactly once`,
    )
    expect(result.systemPrompt).toContain("may move within its segment")
    expect(result.prompt).toContain(input)
  })

  it("appends mandatory marker rules after a custom system prompt", () => {
    const config: Pick<Config["translate"], "customPromptsConfig"> = {
      customPromptsConfig: {
        promptId: "custom-prompt",
        patterns: [
          {
            id: "custom-prompt",
            name: "Custom",
            systemPrompt: "Custom instructions that omit marker handling.",
            prompt: "Translate {{input}} to {{targetLanguage}}.",
          },
        ],
      },
    }
    const input = `<a ${HTML_ATTRIBUTE_MARKER}="7">Read more</a>`

    const result = getTranslatePromptFromConfig(config, "Japanese", input)

    expect(result.systemPrompt).toMatch(/^Custom instructions that omit marker handling\./)
    expect(result.systemPrompt.indexOf("## Protected HTML Marker Rules")).toBeGreaterThan(
      result.systemPrompt.indexOf("Custom instructions that omit marker handling."),
    )
  })

  it("keeps marker rules segment-scoped and after batch rules", () => {
    const input = `<span ${HTML_ATTRIBUTE_MARKER}="0">First</span>\n\n%%\n\n<a ${HTML_ATTRIBUTE_MARKER}="0">Second</a>`

    const result = getTranslatePromptFromConfig(defaultTranslatePromptConfig, "French", input, {
      isBatch: true,
    })

    const batchRulesIndex = result.systemPrompt.indexOf("## Multi-paragraph Translation Rules")
    const markerRulesIndex = result.systemPrompt.indexOf("## Protected HTML Marker Rules")
    expect(batchRulesIndex).toBeGreaterThan(-1)
    expect(markerRulesIndex).toBeGreaterThan(batchRulesIndex)
    expect(result.systemPrompt).toContain(
      "segments are separated by a standalone %% line when present",
    )
    expect(result.systemPrompt).toContain("move a marker to another segment")
  })

  it.each([
    ["plain text", "Hello world"],
    ["unmarked HTML", '<span class="message">Hello</span>'],
    ["a marker name mentioned as text", `Explain ${HTML_ATTRIBUTE_MARKER} to me`],
    [
      "a marker-like string inside another attribute",
      `<span title='preserve ${HTML_ATTRIBUTE_MARKER}="0" exactly'>Hello</span>`,
    ],
  ])("does not append marker rules for %s", (_case, input) => {
    const result = getTranslatePromptFromConfig(defaultTranslatePromptConfig, "Chinese", input)

    expect(result.systemPrompt).not.toContain("## Protected HTML Marker Rules")
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
