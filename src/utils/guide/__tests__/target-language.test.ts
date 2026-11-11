import { describe, expect, it } from "vitest"
import { getGuideTargetLanguageAnswer, resolveGuideTargetLanguage } from "../target-language"

describe("resolveGuideTargetLanguage", () => {
  it("takes the language tag a newer guide page sends", () => {
    expect(resolveGuideTargetLanguage({ languageTag: "pt-PT", langCodeISO6393: "por" })).toBe(
      "pt-PT",
    )
    expect(resolveGuideTargetLanguage({ languageTag: "zh-Hant" })).toBe("zh-Hant")
  })

  it("resolves the ISO 639-3 code an older guide page sends", () => {
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "cmn" })).toBe("zh-Hans")
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "eng" })).toBe("en")
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "por" })).toBe("pt-BR")
  })

  it("falls back to the ISO 639-3 code when the tag is not listed", () => {
    expect(resolveGuideTargetLanguage({ languageTag: "pt", langCodeISO6393: "por" })).toBe("pt-BR")
  })

  it("returns null when the code is missing", () => {
    expect(resolveGuideTargetLanguage({})).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: undefined })).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: null })).toBeNull()
  })

  it("returns null for invalid codes and non-object payloads", () => {
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "zz" })).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: "english" })).toBeNull()
    expect(resolveGuideTargetLanguage({ langCodeISO6393: 42 })).toBeNull()
    expect(resolveGuideTargetLanguage(null)).toBeNull()
    expect(resolveGuideTargetLanguage(undefined)).toBeNull()
    expect(resolveGuideTargetLanguage("cmn")).toBeNull()
  })
})

describe("getGuideTargetLanguageAnswer", () => {
  it("answers with the tag, under the field that says this build reads tags", () => {
    // The guide offers European Portuguese only to an answer with `languageTag`.
    expect(getGuideTargetLanguageAnswer("pt-PT")).toEqual({
      targetLanguage: "pt-PT",
      languageTag: "pt-PT",
    })
  })
})
