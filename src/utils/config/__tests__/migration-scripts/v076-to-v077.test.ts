import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v076-to-v077"

describe("v076-to-v077 migration", () => {
  it("renames subtitle title prompt tokens back to webpage title", () => {
    const migrated = migrate({
      translate: {
        customPromptsConfig: {
          patterns: [
            {
              systemPrompt: "Keep {{videoTitle}} outside subtitle prompts",
              prompt: "{{videoTitle}}",
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
              systemPrompt: "Use {{videoTitle}} and {{videoSummary}}",
              prompt: "Title: {{videoTitle}}\nSummary: {{videoSummary}}\n{{input}}",
            },
          ],
        },
      },
    })

    expect(migrated.videoSubtitles.customPromptsConfig.patterns[0].systemPrompt).toBe(
      "Use {{webTitle}} and {{videoSummary}}",
    )
    expect(migrated.videoSubtitles.customPromptsConfig.patterns[0].prompt).toBe(
      "Title: {{webTitle}}\nSummary: {{videoSummary}}\n{{input}}",
    )
    expect(migrated.translate.customPromptsConfig.patterns[0].systemPrompt).toBe(
      "Keep {{videoTitle}} outside subtitle prompts",
    )
  })

  it("leaves configs without subtitle prompts unchanged", () => {
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: { customPromptsConfig: null } })).toEqual({
      videoSubtitles: { customPromptsConfig: null },
    })
  })
})
