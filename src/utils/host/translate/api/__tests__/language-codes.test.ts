import type { LanguageTag } from "@read-frog/definitions"
import { ISO6393_TO_6391, LANG_CODE_ISO6393_OPTIONS, resolveLanguage } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import {
  toDeepLSourceCode,
  toDeepLTargetCode,
  toGoogleLanguageCode,
  toGoogleSourceCode,
  toMicrosoftLanguageCode,
  toMicrosoftSourceCode,
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

describe("source languages", () => {
  // What a source the old table had no code for, and so sent as "auto", is
  // sent as now when that is not "auto".
  function namedSourcesWithoutOldCode(toSourceCode: (tag: LanguageTag) => string) {
    const named: Record<string, string> = {}
    for (const code of LANG_CODE_ISO6393_OPTIONS) {
      const tag = resolveLanguage(code)
      if (ISO6393_TO_6391[code] !== undefined || tag === null) continue
      const sent = toSourceCode(tag)
      if (sent !== "auto") named[tag] = sent
    }
    return named
  }

  it("sends a source with an old code what it was sent before, except where that was wrong", () => {
    expect(changedRequests(toGoogleSourceCode)).toEqual({
      yue: ["zh", "yue"],
      ckb: ["ku", "ckb"],
    })
    expect(changedRequests(toMicrosoftSourceCode)).toEqual({
      yue: ["zh", "yue"],
      tgl: ["tl", "fil"],
    })
  })

  // A service answers a source it does not list with HTTP 400, where "auto"
  // had it work the language out.
  it("leaves a source the old table had no code for to Google, unless Google lists it", () => {
    expect(namedSourcesWithoutOldCode(toGoogleSourceCode)).toEqual({
      mai: "mai",
      bho: "bho",
      ceb: "ceb",
      rn: "rn",
      mg: "mg",
      mad: "mad",
      ps: "ps",
      ilo: "ilo",
      haw: "haw",
      nso: "nso",
      "fa-AF": "fa-AF",
      war: "war",
      pam: "pam",
      hil: "hil",
      bik: "bik",
      min: "min",
      ace: "ace",
      ban: "ban",
      mak: "mak",
      tet: "tet",
    })
    expect(toGoogleSourceCode("koi")).toBe("auto")
  })

  it("leaves a source the old table had no code for to Microsoft, unless Microsoft lists it", () => {
    expect(namedSourcesWithoutOldCode(toMicrosoftSourceCode)).toEqual({
      mai: "mai",
      bho: "bho",
      mg: "mg",
      ps: "ps",
      nso: "nso",
      "fa-AF": "prs",
    })
    expect(toMicrosoftSourceCode("ceb")).toBe("auto")
  })

  it("passes auto through", () => {
    expect(toGoogleSourceCode("auto")).toBe("auto")
    expect(toMicrosoftSourceCode("auto")).toBe("auto")
    expect(toDeepLSourceCode("auto")).toBeUndefined()
  })
})

describe("DeepL language codes", () => {
  it("names the variety of a target language", () => {
    expect(toDeepLTargetCode("pt-BR")).toBe("PT-BR")
    expect(toDeepLTargetCode("pt-PT")).toBe("PT-PT")
    expect(toDeepLTargetCode("zh-Hans")).toBe("ZH-HANS")
    expect(toDeepLTargetCode("zh-Hant")).toBe("ZH-HANT")
    expect(toDeepLTargetCode("en")).toBe("EN")
    expect(toDeepLTargetCode("de")).toBe("DE")
  })

  it("sends Cantonese, which DeepL lacks, as Traditional Chinese", () => {
    expect(toDeepLTargetCode("yue")).toBe("ZH-HANT")
  })

  it("sends Filipino as Tagalog, as DeepL lists it", () => {
    expect(toDeepLTargetCode("fil")).toBe("TL")
    expect(toDeepLSourceCode("fil")).toBe("TL")
  })

  it("sends a source language without its variety", () => {
    expect(toDeepLSourceCode("pt-PT")).toBe("PT")
    expect(toDeepLSourceCode("zh-Hant")).toBe("ZH")
    expect(toDeepLSourceCode("en")).toBe("EN")
    // Cantonese text was always sent as Chinese, which DeepL reads.
    expect(toDeepLSourceCode("yue")).toBe("ZH")
  })

  it("leaves a source the old table had no code for to DeepL to work out", () => {
    expect(toDeepLSourceCode("ceb")).toBeUndefined()
    expect(toDeepLSourceCode("fa-AF")).toBeUndefined()
  })
})
