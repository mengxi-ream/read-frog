import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v072-to-v073"

describe("v072-to-v073 migration", () => {
  it("adds batchSystemPrompt and appendBatchSystemPrompt to every translate pattern", () => {
    const migrated = migrate({
      translate: {
        customPromptsConfig: {
          promptId: "p1",
          patterns: [
            { id: "p1", name: "P1", systemPrompt: "s1", prompt: "u1" },
            { id: "p2", name: "P2", systemPrompt: "s2", prompt: "u2" },
          ],
        },
      },
    })

    expect(migrated.translate.customPromptsConfig.promptId).toBe("p1")
    expect(migrated.translate.customPromptsConfig.patterns).toHaveLength(2)
    for (const pattern of migrated.translate.customPromptsConfig.patterns) {
      expect(typeof pattern.batchSystemPrompt).toBe("string")
      expect(pattern.batchSystemPrompt).toContain("Multi-paragraph Translation Rules")
      expect(pattern.appendBatchSystemPrompt).toBe(true)
    }
  })

  it("adds the same fields to every videoSubtitles pattern", () => {
    const migrated = migrate({
      videoSubtitles: {
        customPromptsConfig: {
          promptId: "s1",
          patterns: [{ id: "s1", name: "S1", systemPrompt: "ss", prompt: "uu" }],
        },
      },
    })

    expect(migrated.videoSubtitles.customPromptsConfig.patterns[0].appendBatchSystemPrompt).toBe(true)
    expect(migrated.videoSubtitles.customPromptsConfig.patterns[0].batchSystemPrompt).toContain("Multi-paragraph Translation Rules")
  })

  it("handles missing customPromptsConfig gracefully", () => {
    const migrated = migrate({})
    expect(migrated.translate.customPromptsConfig.patterns).toEqual([])
    expect(migrated.videoSubtitles.customPromptsConfig.patterns).toEqual([])
  })
})
