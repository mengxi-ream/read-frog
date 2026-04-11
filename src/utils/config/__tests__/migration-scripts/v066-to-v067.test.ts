import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v066-to-v067"

function createConfig(systemPrompt: string, prompt: string) {
  return {
    translate: {
      customPromptsConfig: {
        promptId: "page-prompt",
        patterns: [
          {
            id: "page-prompt",
            name: "Page Prompt",
            systemPrompt: "Keep {{webTitle}} and {{webSummary}} for webpage prompts",
            prompt: "{{input}}",
          },
        ],
      },
    },
    videoSubtitles: {
      customPromptsConfig: {
        promptId: "subtitle-prompt",
        patterns: [
          {
            id: "subtitle-prompt",
            name: "Subtitle Prompt",
            systemPrompt,
            prompt,
          },
        ],
      },
    },
  }
}

describe("v066-to-v067 migration", () => {
  it("renames subtitle prompt tokens to video-specific names", () => {
    const migrated = migrate(createConfig(
      "Use {{webTitle}} and {{webSummary}}",
      "Title: {{webTitle}}\nSummary: {{webSummary}}\n{{input}}",
    ))

    expect(migrated.videoSubtitles.customPromptsConfig.patterns[0].systemPrompt).toBe(
      "Use {{videoTitle}} and {{videoSummary}}",
    )
    expect(migrated.videoSubtitles.customPromptsConfig.patterns[0].prompt).toBe(
      "Title: {{videoTitle}}\nSummary: {{videoSummary}}\n{{input}}",
    )
  })

  it("leaves webpage prompt tokens unchanged", () => {
    const migrated = migrate(createConfig("Use {{webTitle}}", "{{input}}"))

    expect(migrated.translate.customPromptsConfig.patterns[0].systemPrompt).toBe(
      "Keep {{webTitle}} and {{webSummary}} for webpage prompts",
    )
  })
})
