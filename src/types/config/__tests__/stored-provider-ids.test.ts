import { describe, expect, it } from "vitest"
import { testSeries } from "@/utils/config/__tests__/example/v126"
import { migrate as migrateToV127 } from "@/utils/config/migration-scripts/v126-to-v127"
import { migrate as migrateToV131 } from "@/utils/config/migration-scripts/v130-to-v131"
import { configSchema } from "../config"

const HAIKU = "read-frog-ai:claude-haiku-5-5"

/** What the migrations that move Built-in AI ids write: v127 tiers to Luna, then v131 Luna to Haiku. */
function migrateBuiltInAiIds(config: unknown) {
  return migrateToV131(migrateToV127(config))
}

// A UI context can read storage before the background's v126 → v127 migration
// runs. A config that fails to parse there reads as DEFAULT_CONFIG, and the
// next setting the user changes saves that over the whole config. A tier id
// must read as the model the migrations end on, or that write would put the
// user back on a model v131 moved them off.
describe("configSchema on a config from before Built-in AI models", () => {
  it.each(Object.entries(testSeries))("reads %s as the migrations write it", (_, { config }) => {
    const parsed = configSchema.safeParse(config)

    expect(parsed.error).toBeUndefined()
    expect(parsed.data).toEqual(configSchema.parse(migrateBuiltInAiIds(config)))
  })

  it("reads every field that holds a provider id", () => {
    const config = structuredClone(testSeries["complex-config-from-v020"]!.config)
    config.pageTranslation.providerId = "read-frog-advance-ai"
    config.videoSubtitles.providerId = "read-frog-free-ai"
    config.inputTranslation.providerId = "read-frog-advance-ai"
    config.languageDetection = { mode: "llm", providerId: "read-frog-free-ai" }
    config.selectionToolbar.features.translate.providerId = "read-frog-advance-ai"
    config.selectionToolbar.builtInActions.dictionary.providerId = "read-frog-advance-ai"
    config.selectionToolbar.noteSuggestion.providerId = "read-frog-free-ai"
    config.translationHub = {
      ...config.translationHub,
      selectedProviderIds: [
        "read-frog-free-ai",
        "google-translate-default",
        "read-frog-advance-ai",
      ],
    }

    const parsed = configSchema.parse(config)

    expect(parsed).toEqual(configSchema.parse(migrateBuiltInAiIds(config)))
    expect(parsed.pageTranslation.providerId).toBe(HAIKU)
    expect(parsed.videoSubtitles.providerId).toBe(HAIKU)
    expect(parsed.inputTranslation.providerId).toBe(HAIKU)
    expect(parsed.languageDetection.providerId).toBe(HAIKU)
    expect(parsed.selectionToolbar.features.translate.providerId).toBe(HAIKU)
    expect(parsed.selectionToolbar.builtInActions.dictionary.providerId).toBe(HAIKU)
    expect(parsed.selectionToolbar.noteSuggestion.providerId).toBe(HAIKU)
    expect(parsed.translationHub.selectedProviderIds).toEqual([HAIKU, "google-translate-default"])
  })

  it("fills the built-in actions a config from before v104 lacks with the model the migrations end on", () => {
    const config = structuredClone(testSeries["complex-config-from-v020"]!.config)
    delete config.selectionToolbar.builtInActions.sentenceAnalysis
    delete config.selectionToolbar.builtInActions.improveWriting

    const parsed = configSchema.parse(config)

    expect(parsed.selectionToolbar.builtInActions.sentenceAnalysis.providerId).toBe(HAIKU)
    expect(parsed.selectionToolbar.builtInActions.improveWriting.providerId).toBe(HAIKU)
  })

  it("still rejects a provider id nothing knows", () => {
    const config = structuredClone(testSeries["complex-config-from-v020"]!.config)
    config.pageTranslation.providerId = "read-frog-pro-ai"

    expect(configSchema.safeParse(config).success).toBe(false)
  })
})
