import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { migrateConfig, runMigration } from "../../migration"
import { migrate } from "../../migration-scripts/v130-to-v131"
import { testSeries as v126TestSeries } from "../example/v126"
import { testSeries as v130TestSeries } from "../example/v130"
import { testSeries as v131TestSeries } from "../example/v131"

const HAIKU = "read-frog-ai:claude-haiku-5-5"
const LUNA = "read-frog-ai:gpt-6-luna"
const DEEPSEEK = "read-frog-ai:deepseek-v4.1-flash"
const SOL = "read-frog-ai:gpt-6.2-sol"
const SONNET = "read-frog-ai:claude-sonnet-5-5"

describe("v130-to-v131 migration", () => {
  it("moves every stored normal-tier model other than Haiku to Haiku", () => {
    const oldConfig = {
      pageTranslation: { providerId: LUNA, mode: "bilingual" },
      videoSubtitles: { providerId: DEEPSEEK },
      inputTranslation: { providerId: LUNA, enabled: true },
      languageDetection: { mode: "llm", providerId: DEEPSEEK },
      selectionToolbar: {
        features: {
          translate: { enabled: true, providerId: DEEPSEEK },
          speak: { enabled: true },
        },
        builtInActions: {
          dictionary: { enabled: true, providerId: LUNA },
          sentenceAnalysis: { enabled: true, providerId: "openai-default" },
          improveWriting: { enabled: true, providerId: SOL },
        },
        customActions: [
          { id: "a", providerId: DEEPSEEK },
          { id: "b", providerId: "deepseek-default" },
          { id: "c", providerId: SONNET },
          { id: "d", providerId: LUNA },
        ],
        noteSuggestion: { enabled: true, actionId: "dictionary", providerId: LUNA },
      },
      translationHub: { selectedProviderIds: [LUNA, "google-translate-default"] },
      builtInAi: { models: {} },
      glossary: { enabled: true },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      pageTranslation: { providerId: HAIKU, mode: "bilingual" },
      videoSubtitles: { providerId: HAIKU },
      inputTranslation: { providerId: HAIKU, enabled: true },
      languageDetection: { mode: "llm", providerId: HAIKU },
      selectionToolbar: {
        features: {
          translate: { enabled: true, providerId: HAIKU },
          speak: { enabled: true },
        },
        builtInActions: {
          dictionary: { enabled: true, providerId: HAIKU },
          sentenceAnalysis: { enabled: true, providerId: "openai-default" },
          improveWriting: { enabled: true, providerId: SOL },
        },
        customActions: [
          { id: "a", providerId: HAIKU },
          { id: "b", providerId: "deepseek-default" },
          { id: "c", providerId: SONNET },
          { id: "d", providerId: HAIKU },
        ],
        noteSuggestion: { enabled: true, actionId: "dictionary", providerId: HAIKU },
      },
      translationHub: { selectedProviderIds: [HAIKU, "google-translate-default"] },
      builtInAi: { models: {} },
      glossary: { enabled: true },
    })
    expect(oldConfig).toEqual(snapshot)
    // Holders that named nothing to move are kept by identity.
    expect(migrated.selectionToolbar.features.speak).toBe(oldConfig.selectionToolbar.features.speak)
    expect(migrated.selectionToolbar.customActions[1]).toBe(
      oldConfig.selectionToolbar.customActions[1],
    )
    expect(migrated.glossary).toBe(oldConfig.glossary)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("moves the tier ids from before v127 to Haiku too", () => {
    const migrated = migrate({
      pageTranslation: { providerId: "read-frog-free-ai" },
      selectionToolbar: {
        builtInActions: { dictionary: { providerId: "read-frog-advance-ai" } },
      },
      translationHub: { selectedProviderIds: ["read-frog-advance-ai", "read-frog-free-ai"] },
    })

    expect(migrated).toEqual({
      pageTranslation: { providerId: HAIKU },
      selectionToolbar: { builtInActions: { dictionary: { providerId: HAIKU } } },
      translationHub: { selectedProviderIds: [HAIKU] },
    })
  })

  it("keeps one hub card for the models that collapse into Haiku, where the first of them was", () => {
    const migrated = migrate({
      translationHub: {
        selectedProviderIds: [
          "microsoft-translate-default",
          DEEPSEEK,
          "openai-default",
          LUNA,
          SOL,
          HAIKU,
        ],
      },
    })
    expect(migrated.translationHub.selectedProviderIds).toEqual([
      "microsoft-translate-default",
      HAIKU,
      "openai-default",
      SOL,
    ])

    expect(
      migrate({ translationHub: { selectedProviderIds: [HAIKU, SONNET, LUNA] } }).translationHub
        .selectedProviderIds,
    ).toEqual([HAIKU, SONNET])
  })

  it("returns a config with nothing to move by identity", () => {
    const current = {
      pageTranslation: { providerId: HAIKU },
      videoSubtitles: { providerId: SOL },
      inputTranslation: { providerId: "microsoft-translate-default" },
      languageDetection: { mode: "llm", providerId: SONNET },
      selectionToolbar: {
        features: { translate: { providerId: "google-translate-default" } },
        builtInActions: { dictionary: { providerId: "openai-default" } },
        customActions: [{ id: "a", providerId: HAIKU }],
        noteSuggestion: { providerId: SONNET },
      },
      translationHub: { selectedProviderIds: [HAIKU, SOL, "google-translate-default"] },
      // A BYOK provider's own model of the same name is not Built-in AI.
      providersConfig: [{ id: "openai-default", provider: "openai", model: "gpt-6-luna" }],
      builtInAi: { models: { "gpt-6-luna": { reasoning: "high" } } },
    }

    expect(migrate(current)).toBe(current)
    expect(migrate({ translationHub: { selectedProviderIds: null } })).toEqual({
      translationHub: { selectedProviderIds: null },
    })
  })

  it("leaves builtInAi.models as it is", () => {
    const builtInAi = {
      models: {
        "gpt-6-luna": { reasoning: "high" },
        "deepseek-v4.1-flash": { reasoning: "low" },
      },
    }
    const migrated = migrate({ pageTranslation: { providerId: LUNA }, builtInAi })

    expect(migrated.pageTranslation.providerId).toBe(HAIKU)
    expect(migrated.builtInAi).toBe(builtInAi)
    expect(migrated.builtInAi.models[HAIKU.slice("read-frog-ai:".length)]).toBeUndefined()
  })

  it("leaves malformed config shapes for the schema parse", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate("config")).toBe("config")
    const array: unknown[] = []
    expect(migrate(array)).toBe(array)

    const malformed = {
      pageTranslation: null,
      videoSubtitles: [LUNA],
      inputTranslation: { providerId: 1 },
      selectionToolbar: { features: null, customActions: "x", builtInActions: [] },
      languageDetection: { mode: "basic" },
      translationHub: { selectedProviderIds: LUNA },
    }
    expect(migrate(malformed)).toBe(malformed)

    expect(
      migrate({
        selectionToolbar: {
          features: { translate: null },
          customActions: [null, { id: "a", providerId: LUNA }],
        },
        translationHub: { selectedProviderIds: [DEEPSEEK, 7, null] },
      }),
    ).toEqual({
      selectionToolbar: {
        features: { translate: null },
        customActions: [null, { id: "a", providerId: HAIKU }],
      },
      translationHub: { selectedProviderIds: [HAIKU, 7, null] },
    })
  })

  it("produces the v131 fixtures, and a valid current config, from every v130 series", async () => {
    for (const [seriesId, series] of Object.entries(v130TestSeries)) {
      expect(await runMigration(131, structuredClone(series.config))).toEqual(
        v131TestSeries[seriesId]!.config,
      )
      const migrated = await migrateConfig(structuredClone(series.config), 130)
      expect(configSchema.safeParse(migrated).success).toBe(true)
      expect(JSON.stringify(migrated)).not.toContain(LUNA)
    }
  })

  it("takes a config from before v127 through Luna to Haiku", async () => {
    for (const series of Object.values(v126TestSeries)) {
      const migrated = await migrateConfig(structuredClone(series.config), 126)
      const serialized = JSON.stringify(migrated)
      expect(serialized).not.toContain(LUNA)
      expect(serialized).not.toContain("read-frog-free-ai")
      expect(serialized).not.toContain("read-frog-advance-ai")
    }
    const series = v126TestSeries["prompt-token-migration-coverage"]!
    const migrated = await migrateConfig(structuredClone(series.config), 126)
    expect(migrated.selectionToolbar.builtInActions.dictionary.providerId).toBe(HAIKU)
  })
})
