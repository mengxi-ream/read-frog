import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrateConfig, runMigration } from "../../migration"
import { migrate } from "../../migration-scripts/v126-to-v127"
import { testSeries as v126TestSeries } from "../example/v126"
import { testSeries as v127TestSeries } from "../example/v127"

const LUNA = "read-frog-ai:gpt-6-luna"

describe("v126-to-v127 migration", () => {
  it("moves every stored tier id to its model", () => {
    const oldConfig = {
      pageTranslation: { providerId: "read-frog-free-ai", mode: "bilingual" },
      videoSubtitles: { providerId: "read-frog-advance-ai" },
      inputTranslation: { providerId: "read-frog-free-ai", enabled: true },
      languageDetection: { mode: "llm", providerId: "read-frog-advance-ai" },
      selectionToolbar: {
        features: {
          translate: { enabled: true, providerId: "read-frog-advance-ai" },
          speak: { enabled: true },
        },
        builtInActions: {
          dictionary: { enabled: true, providerId: "read-frog-free-ai" },
          sentenceAnalysis: { enabled: true, providerId: "openai-default" },
        },
        customActions: [
          { id: "a", providerId: "read-frog-advance-ai" },
          { id: "b", providerId: "deepseek-default" },
        ],
        noteSuggestion: { enabled: true, actionId: "dictionary", providerId: "read-frog-free-ai" },
      },
      translationHub: { selectedProviderIds: ["read-frog-free-ai", "google-translate-default"] },
      glossary: { enabled: true },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      pageTranslation: { providerId: LUNA, mode: "bilingual" },
      videoSubtitles: { providerId: LUNA },
      inputTranslation: { providerId: LUNA, enabled: true },
      languageDetection: { mode: "llm", providerId: LUNA },
      selectionToolbar: {
        features: {
          translate: { enabled: true, providerId: LUNA },
          speak: { enabled: true },
        },
        builtInActions: {
          dictionary: { enabled: true, providerId: LUNA },
          sentenceAnalysis: { enabled: true, providerId: "openai-default" },
        },
        customActions: [
          { id: "a", providerId: LUNA },
          { id: "b", providerId: "deepseek-default" },
        ],
        noteSuggestion: { enabled: true, actionId: "dictionary", providerId: LUNA },
      },
      translationHub: { selectedProviderIds: [LUNA, "google-translate-default"] },
      glossary: { enabled: true },
      builtInAi: { models: {} },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps one hub card when both tiers were selected, in the first one's place", () => {
    const migrated = migrate({
      translationHub: {
        selectedProviderIds: [
          "microsoft-translate-default",
          "read-frog-advance-ai",
          "openai-default",
          "read-frog-free-ai",
        ],
      },
    })

    expect(migrated.translationHub.selectedProviderIds).toEqual([
      "microsoft-translate-default",
      LUNA,
      "openai-default",
    ])
  })

  it("leaves providers that are not tiers, and objects that name none, untouched", () => {
    const pageTranslation = { providerId: "microsoft-translate-default" }
    const selectionToolbar = {
      features: { translate: { providerId: "google-translate-default" } },
      builtInActions: { dictionary: { providerId: "openai-default" } },
      customActions: [{ id: "a", providerId: "openai-default" }],
      noteSuggestion: { providerId: "openai-default" },
    }
    const translationHub = { selectedProviderIds: null }

    const migrated = migrate({ pageTranslation, selectionToolbar, translationHub })

    expect(migrated.pageTranslation).toBe(pageTranslation)
    expect(migrated.selectionToolbar).toBe(selectionToolbar)
    expect(migrated.translationHub).toBe(translationHub)
    expect(migrated.builtInAi).toEqual({ models: {} })
  })

  it("keeps a builtInAi already there", () => {
    const builtInAi = { models: { "gpt-6-luna": { reasoning: "low" } } }
    const current = { pageTranslation: { providerId: LUNA }, builtInAi }

    expect(migrate(current)).toBe(current)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(
      migrate({
        selectionToolbar: { features: null, customActions: "x", builtInActions: [] },
        languageDetection: { mode: "basic" },
        translationHub: { selectedProviderIds: "read-frog-free-ai" },
      }),
    ).toEqual({
      selectionToolbar: { features: null, customActions: "x", builtInActions: [] },
      languageDetection: { mode: "basic" },
      translationHub: { selectedProviderIds: "read-frog-free-ai" },
      builtInAi: { models: {} },
    })
  })

  it("produces the v127 fixtures, and a valid current config, from every v126 series", async () => {
    for (const [seriesId, series] of Object.entries(v126TestSeries)) {
      expect(await runMigration(127, structuredClone(series.config))).toEqual(
        v127TestSeries[seriesId]!.config,
      )
      const migrated = await migrateConfig(structuredClone(series.config), 126)
      expect(configSchema.safeParse(migrated).success).toBe(true)
    }
  })
})
