import { LANG_CODE_TO_EN_NAME, langCodeISO6393Schema } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import {
  ALL_LANGUAGES,
  appliesToLanguage,
  defaultGlossaryTargetLang,
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
    expect(langCodeISO6393Schema.options).not.toContain(ALL_LANGUAGES)
    expect(Object.hasOwn(LANG_CODE_TO_EN_NAME, ALL_LANGUAGES)).toBe(false)
  })
})

describe("appliesToLanguage", () => {
  it("passes a row written for the language in play", () => {
    expect(appliesToLanguage("cmn", "cmn")).toBe(true)
  })

  it("blocks a row written for another language", () => {
    expect(appliesToLanguage("jpn", "cmn")).toBe(false)
  })

  it("passes an all-languages row whatever the page is translating into", () => {
    expect(appliesToLanguage(ALL_LANGUAGES, "cmn")).toBe(true)
    expect(appliesToLanguage(ALL_LANGUAGES, "jpn")).toBe(true)
    expect(appliesToLanguage(ALL_LANGUAGES, "eng")).toBe(true)
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
    expect(targetLangPrecedence(ALL_LANGUAGES)).toBeLessThan(targetLangPrecedence("cmn"))
  })

  it("gives every specific language the same rank", () => {
    expect(targetLangPrecedence("cmn")).toBe(targetLangPrecedence("jpn"))
  })
})

describe("defaultGlossaryTargetLang", () => {
  it("files a term with no wording under every language", () => {
    expect(defaultGlossaryTargetLang("", "cmn")).toBe(ALL_LANGUAGES)
    expect(defaultGlossaryTargetLang("   ", "cmn")).toBe(ALL_LANGUAGES)
  })

  it("files a wording under the language it was written in", () => {
    expect(defaultGlossaryTargetLang("围棋", "cmn")).toBe("cmn")
    expect(defaultGlossaryTargetLang("囲碁", "jpn")).toBe("jpn")
  })
})
