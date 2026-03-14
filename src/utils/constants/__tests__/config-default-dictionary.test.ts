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

describe("default config default dictionary action", () => {
  it("uses stable semantic IDs for outputSchema fields", () => {
    const dictionaryAction = DEFAULT_CONFIG.selectionToolbar.customActions.find(
      action => action.id === "default-dictionary",
    )

    expect(dictionaryAction).toBeDefined()
    expect(dictionaryAction?.outputSchema.map(field => field.id)).toEqual(DEFAULT_DICTIONARY_FIELD_IDS)
    expect(dictionaryAction?.outputSchema.some(field => /^default-dictionary-\d+$/.test(field.id))).toBe(false)
  })
})
