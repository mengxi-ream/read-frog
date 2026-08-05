import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrate } from "../../migration-scripts/v091-to-v092"
import { testSeries as v091TestSeries } from "../example/v091"

function prompt(name: string, id: string) {
  return {
    id,
    name,
    systemPrompt: `${name} system`,
    prompt: `${name} prompt`,
  }
}

describe("v091-to-v092 migration", () => {
  it("persists default as a real id for page and subtitle translation", () => {
    const oldConfig = {
      translate: { customPromptsConfig: { promptId: null, patterns: [] } },
      videoSubtitles: { customPromptsConfig: { promptId: null, patterns: [] } },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      translate: { customPromptsConfig: { promptId: "default", patterns: [] } },
      videoSubtitles: { customPromptsConfig: { promptId: "default", patterns: [] } },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("renames page custom prompts that collide with both built-in ids", () => {
    const oldConfig = {
      translate: {
        customPromptsConfig: {
          promptId: "precision-rewrite",
          patterns: [
            prompt("Existing suffix", "precision-rewrite-custom"),
            prompt("Old default", "default"),
            prompt("Old precision", "precision-rewrite"),
            prompt("Duplicate precision", "precision-rewrite"),
          ],
        },
      },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.translate.customPromptsConfig).toEqual({
      promptId: "precision-rewrite-custom-2",
      patterns: [
        prompt("Existing suffix", "precision-rewrite-custom"),
        prompt("Old default", "default-custom"),
        prompt("Old precision", "precision-rewrite-custom-2"),
        prompt("Duplicate precision", "precision-rewrite-custom-3"),
      ],
    })
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("keeps a selected custom default selected on both translation surfaces", () => {
    const oldConfig = {
      translate: {
        customPromptsConfig: {
          promptId: "default",
          patterns: [prompt("Page custom default", "default")],
        },
      },
      videoSubtitles: {
        customPromptsConfig: {
          promptId: "default",
          patterns: [prompt("Subtitle custom default", "default")],
        },
      },
    }

    const migrated = migrate(oldConfig)

    expect(migrated.translate.customPromptsConfig).toEqual({
      promptId: "default-custom",
      patterns: [prompt("Page custom default", "default-custom")],
    })
    expect(migrated.videoSubtitles.customPromptsConfig).toEqual({
      promptId: "default-custom",
      patterns: [prompt("Subtitle custom default", "default-custom")],
    })
  })

  it("does not reserve precision-rewrite for subtitle custom prompts", () => {
    const oldConfig = {
      videoSubtitles: {
        customPromptsConfig: {
          promptId: "precision-rewrite",
          patterns: [prompt("Subtitle precision", "precision-rewrite")],
        },
      },
    }

    expect(migrate(oldConfig)).toEqual(oldConfig)
  })

  it("does not add absent translation surfaces to partial configs", () => {
    expect(
      migrate({
        translate: { customPromptsConfig: { promptId: null, patterns: [] } },
      }),
    ).toEqual({
      translate: { customPromptsConfig: { promptId: "default", patterns: [] } },
    })
  })

  it("leaves malformed and unrelated shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ translate: null, videoSubtitles: [] })).toEqual({
      translate: null,
      videoSubtitles: [],
    })
    expect(
      migrate({ translate: { customPromptsConfig: { promptId: null, patterns: null } } }),
    ).toEqual({ translate: { customPromptsConfig: { promptId: null, patterns: null } } })
  })

  it.each(Object.entries(v091TestSeries))(
    "keeps the full %s fixture schema-valid",
    (_seriesId, series) => {
      const migrated = migrate(series.config)
      const parseResult = configSchema.safeParse(migrated)

      expect(parseResult.success).toBe(true)
    },
  )

  it("keeps a full config schema-valid while protecting selected reserved custom ids", () => {
    const baseConfig = structuredClone(v091TestSeries["complex-config-from-v020"]!.config)
    baseConfig.translate.customPromptsConfig = {
      promptId: "precision-rewrite",
      patterns: [prompt("Old precision", "precision-rewrite")],
    }
    baseConfig.videoSubtitles.customPromptsConfig = {
      promptId: "default",
      patterns: [prompt("Old subtitle default", "default")],
    }

    const migrated = migrate(baseConfig)

    expect(migrated.translate.customPromptsConfig.promptId).toBe("precision-rewrite-custom")
    expect(migrated.videoSubtitles.customPromptsConfig.promptId).toBe("default-custom")
    expect(configSchema.safeParse(migrated).success).toBe(true)
  })
})
