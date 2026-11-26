import { LANGUAGE_ENGLISH_NAMES, languageTagSchema } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import {
  ALL_LANGUAGES,
  appliesToLanguage,
  defaultGlossaryTargetLang,
  normalizeStoredTargetLang,
  targetLangPrecedence,
} from "../target-language"

describe("aLL_LANGUAGES as a stored value", () => {
  /**
   * The whole design rests on this: the value sits in the same column as a
   * language code, in the same unique index, and is written into the CSV's
   * language column. If the extension's list ever grew a code spelled `all`
   * — ISO 639-3 has one, Allar — the two would be indistinguishable on import
   * and a user's Allar terms would become language-independent ones.
   */
  it("is not a code the extension can translate into", () => {
    expect(languageTagSchema.options).not.toContain(ALL_LANGUAGES)
    expect(Object.hasOwn(LANGUAGE_ENGLISH_NAMES, ALL_LANGUAGES)).toBe(false)
  })
})

describe("appliesToLanguage", () => {
  it("passes a row written for the language in play", () => {
    expect(appliesToLanguage("zh-Hans", "zh-Hans")).toBe(true)
  })

  it("blocks a row written for another language", () => {
    expect(appliesToLanguage("ja", "zh-Hans")).toBe(false)
  })

  it("passes an all-languages row whatever the page is translating into", () => {
    expect(appliesToLanguage(ALL_LANGUAGES, "zh-Hans")).toBe(true)
    expect(appliesToLanguage(ALL_LANGUAGES, "ja")).toBe(true)
    expect(appliesToLanguage(ALL_LANGUAGES, "en")).toBe(true)
  })
})

describe("targetLangPrecedence", () => {
  /**
   * Sorting by this puts the all-languages rows FIRST, and the merge keeps the
   * LAST entry for a match key — so first means overridden. Reversing the two
   * numbers would silently invert the rule, which is why they are asserted
   * rather than left to the sort's callers.
   */
  it("ranks an all-languages row ahead of a language-specific one", () => {
    expect(targetLangPrecedence(ALL_LANGUAGES)).toBeLessThan(targetLangPrecedence("zh-Hans"))
  })

  it("gives every specific language the same rank", () => {
    expect(targetLangPrecedence("zh-Hans")).toBe(targetLangPrecedence("ja"))
  })
})

describe("defaultGlossaryTargetLang", () => {
  it("files a term with no wording under every language", () => {
    expect(defaultGlossaryTargetLang("", "zh-Hans")).toBe(ALL_LANGUAGES)
    expect(defaultGlossaryTargetLang("   ", "zh-Hans")).toBe(ALL_LANGUAGES)
  })

  it("files a wording under the language it was written in", () => {
    expect(defaultGlossaryTargetLang("围棋", "zh-Hans")).toBe("zh-Hans")
    expect(defaultGlossaryTargetLang("囲碁", "ja")).toBe("ja")
  })
})

// What the glossary database's version 7 upgrade and incoming synced glossaries
// run every stored `targetLang` through.
describe("normalizeStoredTargetLang", () => {
  it("moves a term written under an ISO 639-3 code to the language's tag", () => {
    expect(normalizeStoredTargetLang("cmn")).toBe("zh-Hans")
    expect(normalizeStoredTargetLang("cmn-Hant")).toBe("zh-Hant")
    expect(normalizeStoredTargetLang("por")).toBe("pt-BR")
    expect(normalizeStoredTargetLang("eng")).toBe("en")
  })

  it("keeps tags, the all-languages value and anything it does not know", () => {
    expect(normalizeStoredTargetLang("pt-PT")).toBe("pt-PT")
    expect(normalizeStoredTargetLang("yue")).toBe("yue")
    expect(normalizeStoredTargetLang(ALL_LANGUAGES)).toBe(ALL_LANGUAGES)
    expect(normalizeStoredTargetLang("xx")).toBe("xx")
  })
})
