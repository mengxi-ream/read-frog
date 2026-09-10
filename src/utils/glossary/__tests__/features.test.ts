import { describe, expect, it } from "vitest"
import { FEATURE_KEYS } from "@/utils/constants/feature-providers"
import { GLOSSARY_FEATURE_KEYS } from "../features"

describe("GLOSSARY_FEATURE_KEYS", () => {
  it("covers exactly the four prompt-based translation features", () => {
    expect(GLOSSARY_FEATURE_KEYS).toEqual([
      "pageTranslation",
      "videoSubtitles",
      "selectionTranslation",
      "inputTranslation",
    ])
  })

  it("excludes note suggestion, which is a dictionary lookup rather than a translation", () => {
    expect(GLOSSARY_FEATURE_KEYS).not.toContain("noteSuggestion")
  })

  it("only names features the provider registry knows about", () => {
    for (const key of GLOSSARY_FEATURE_KEYS) {
      expect(FEATURE_KEYS).toContain(key)
    }
  })
})
