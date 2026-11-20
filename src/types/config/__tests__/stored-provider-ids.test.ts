import { describe, expect, it } from "vitest"
import { testSeries } from "@/utils/config/__tests__/example/v126"
import { migrate } from "@/utils/config/migration-scripts/v126-to-v127"
import { configSchema } from "../config"

// A UI context can read storage before the background's v126 → v127 migration
// runs. A config that fails to parse there reads as DEFAULT_CONFIG, and the
// next setting the user changes saves that over the whole config.
describe("configSchema on a config from before Built-in AI models", () => {
  it.each(Object.entries(testSeries))("reads %s as the migration writes it", (_, { config }) => {
    const parsed = configSchema.safeParse(config)

    expect(parsed.error).toBeUndefined()
    expect(parsed.data).toEqual(configSchema.parse(migrate(config)))
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

    expect(parsed).toEqual(configSchema.parse(migrate(config)))
    expect(parsed.pageTranslation.providerId).toBe("read-frog-ai:gpt-6-luna")
    expect(parsed.videoSubtitles.providerId).toBe("read-frog-ai:gpt-6-luna")
    expect(parsed.inputTranslation.providerId).toBe("read-frog-ai:gpt-6-luna")
    expect(parsed.languageDetection.providerId).toBe("read-frog-ai:gpt-6-luna")
    expect(parsed.selectionToolbar.features.translate.providerId).toBe("read-frog-ai:gpt-6-luna")
    expect(parsed.selectionToolbar.builtInActions.dictionary.providerId).toBe(
      "read-frog-ai:gpt-6-luna",
    )
    expect(parsed.selectionToolbar.noteSuggestion.providerId).toBe("read-frog-ai:gpt-6-luna")
    expect(parsed.translationHub.selectedProviderIds).toEqual([
      "read-frog-ai:gpt-6-luna",
      "google-translate-default",
    ])
  })

  it("still rejects a provider id nothing knows", () => {
    const config = structuredClone(testSeries["complex-config-from-v020"]!.config)
    config.pageTranslation.providerId = "read-frog-pro-ai"

    expect(configSchema.safeParse(config).success).toBe(false)
  })
})
