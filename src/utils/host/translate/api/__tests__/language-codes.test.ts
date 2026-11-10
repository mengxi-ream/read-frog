import type { LanguageTag } from "@read-frog/definitions"
import { ISO6393_TO_6391, LANG_CODE_ISO6393_OPTIONS, resolveLanguage } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import {
  toDeepLLanguageCode,
  toGoogleLanguageCode,
  toMicrosoftLanguageCode,
} from "../language-codes"

// Each language a service was sent something different for than before
// languages were keyed by BCP 47 tag, when they were sent their ISO 639-1
// code. A language with no ISO 639-1 code was never sent (it raised an error);
// sending it now is not a change to an existing request, so it is left out.
function changedRequests(toCode: (tag: LanguageTag) => string) {
  const changed: Record<string, [string, string]> = {}
  for (const code of LANG_CODE_ISO6393_OPTIONS) {
    const before = ISO6393_TO_6391[code]
    const tag = resolveLanguage(code)
    if (before === undefined || tag === null) continue
    const after = toCode(tag)
    if (after !== before) changed[code] = [before, after]
  }
  return changed
}

describe("Google and Microsoft language codes", () => {
  it("sends Google what it was sent before, except where that was wrong", () => {
    expect(changedRequests(toGoogleLanguageCode)).toEqual({
      // Cantonese was sent as Chinese and came back in Mandarin.
      yue: ["zh", "yue"],
      // Google's `ku` is Kurmanji; Central Kurdish is `ckb`.
      ckb: ["ku", "ckb"],
    })
  })

  it("sends Microsoft what it was sent before, except where that was wrong", () => {
    expect(changedRequests(toMicrosoftLanguageCode)).toEqual({
      yue: ["zh", "yue"],
      // Microsoft rejects `tl`.
      tgl: ["tl", "fil"],
    })
  })

  it("sends European Portuguese as pt-PT", () => {
    expect(toGoogleLanguageCode("pt-PT")).toBe("pt-PT")
    expect(toMicrosoftLanguageCode("pt-PT")).toBe("pt-PT")
  })

  it("sends Microsoft its own codes for Central Kurdish and Dari", () => {
    expect(toMicrosoftLanguageCode("ckb")).toBe("ku")
    expect(toMicrosoftLanguageCode("fa-AF")).toBe("prs")
    expect(toGoogleLanguageCode("fa-AF")).toBe("fa-AF")
  })
})

describe("DeepL language codes", () => {
  it("names the variety of a target language", () => {
    expect(toDeepLLanguageCode("pt-BR", "target")).toBe("PT-BR")
    expect(toDeepLLanguageCode("pt-PT", "target")).toBe("PT-PT")
    expect(toDeepLLanguageCode("zh-Hans", "target")).toBe("ZH-HANS")
    expect(toDeepLLanguageCode("zh-Hant", "target")).toBe("ZH-HANT")
    expect(toDeepLLanguageCode("en", "target")).toBe("EN")
    expect(toDeepLLanguageCode("de", "target")).toBe("DE")
  })

  it("sends Cantonese, which DeepL lacks, as Traditional Chinese", () => {
    expect(toDeepLLanguageCode("yue", "target")).toBe("ZH-HANT")
  })

  it("sends a source language without its variety", () => {
    expect(toDeepLLanguageCode("pt-PT", "source")).toBe("PT")
    expect(toDeepLLanguageCode("zh-Hant", "source")).toBe("ZH")
    expect(toDeepLLanguageCode("en", "source")).toBe("EN")
  })
})
