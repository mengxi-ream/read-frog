import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v096-to-v097"

const OLD = "read-frog-ultra-ai"
const NEW = "read-frog-advance-ai"

/** A config holding the old id at every one of the eight persisted paths. */
function configWithOldIdEverywhere() {
  return {
    pageTranslation: { providerId: OLD, other: 1 },
    videoSubtitles: { providerId: OLD },
    inputTranslation: { providerId: OLD },
    languageDetection: { mode: "llm", providerId: OLD },
    selectionToolbar: {
      noteSuggestion: { providerId: OLD, enabled: true },
      features: { translate: { providerId: OLD }, explain: { enabled: true } },
      builtInActions: { dictionary: { providerId: OLD }, other: { providerId: "openai-default" } },
      customActions: [
        { id: "a", providerId: OLD },
        { id: "b", providerId: "openai-default" },
      ],
    },
  }
}

describe("v096 to v097 migration", () => {
  it("renames the provider id at every persisted path", () => {
    const migrated = migrate(configWithOldIdEverywhere())

    expect(migrated.pageTranslation.providerId).toBe(NEW)
    expect(migrated.videoSubtitles.providerId).toBe(NEW)
    expect(migrated.inputTranslation.providerId).toBe(NEW)
    expect(migrated.languageDetection.providerId).toBe(NEW)
    expect(migrated.selectionToolbar.noteSuggestion.providerId).toBe(NEW)
    expect(migrated.selectionToolbar.features.translate.providerId).toBe(NEW)
    expect(migrated.selectionToolbar.builtInActions.dictionary.providerId).toBe(NEW)
    expect(migrated.selectionToolbar.customActions[0].providerId).toBe(NEW)
  })

  it("leaves every other provider id and sibling key alone", () => {
    const migrated = migrate(configWithOldIdEverywhere())

    expect(migrated.selectionToolbar.customActions[1].providerId).toBe("openai-default")
    expect(migrated.selectionToolbar.builtInActions.other.providerId).toBe("openai-default")
    expect(migrated.selectionToolbar.features.explain).toEqual({ enabled: true })
    expect(migrated.pageTranslation.other).toBe(1)
    expect(migrated.languageDetection.mode).toBe("llm")
    expect(migrated.selectionToolbar.noteSuggestion.enabled).toBe(true)
  })

  it("is idempotent", () => {
    const once = migrate(configWithOldIdEverywhere())
    expect(migrate(structuredClone(once))).toEqual(once)
  })

  it("returns an untouched config unchanged", () => {
    const config = {
      pageTranslation: { providerId: "openai-default" },
      selectionToolbar: { customActions: [{ id: "a", providerId: "google-default" }] },
    }
    expect(migrate(structuredClone(config))).toEqual(config)
  })

  it("tolerates missing, malformed, and non-object sections", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate("nope")).toBe("nope")
    expect(migrate({})).toEqual({})
    expect(migrate({ pageTranslation: null, selectionToolbar: "x" })).toEqual({
      pageTranslation: null,
      selectionToolbar: "x",
    })
    expect(migrate({ selectionToolbar: { customActions: "not-an-array" } })).toEqual({
      selectionToolbar: { customActions: "not-an-array" },
    })
    expect(migrate({ selectionToolbar: { features: null, builtInActions: null } })).toEqual({
      selectionToolbar: { features: null, builtInActions: null },
    })
  })

  it("does not mutate the input", () => {
    const config = configWithOldIdEverywhere()
    const snapshot = structuredClone(config)
    migrate(config)
    expect(config).toEqual(snapshot)
  })
})
