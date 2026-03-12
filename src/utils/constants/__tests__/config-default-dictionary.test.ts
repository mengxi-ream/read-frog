import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "../config"

const DEFAULT_DICTIONARY_FIELD_IDS = [
  "default-dictionary-term",
  "default-dictionary-phonetic",
  "default-dictionary-part-of-speech",
  "default-dictionary-definition",
  "default-dictionary-context",
  "default-dictionary-context-translation",
  "default-dictionary-difficulty",
] as const

describe("dEFAULT_CONFIG default dictionary feature", () => {
  it("uses stable semantic IDs for outputSchema fields", () => {
    const dictionaryFeature = DEFAULT_CONFIG.selectionToolbar.customFeatures.find(
      feature => feature.id === "default-dictionary",
    )

    expect(dictionaryFeature).toBeDefined()
    expect(dictionaryFeature?.outputSchema.map(field => field.id)).toEqual(DEFAULT_DICTIONARY_FIELD_IDS)
    expect(dictionaryFeature?.outputSchema.some(field => /^default-dictionary-\d+$/.test(field.id))).toBe(false)
  })
})
