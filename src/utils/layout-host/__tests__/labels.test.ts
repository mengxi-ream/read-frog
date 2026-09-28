import { LANG_CODE_ISO6393_OPTIONS, LOCALE_TO_ISO6393 } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import { SUPPORTED_UI_LOCALES } from "@/utils/i18n/locales"
import {
  contentLocaleFor,
  getImproveWritingLabels,
  getSentenceAnalysisLabels,
  langCodeOfLocale,
} from "../labels"

const SA_PREFIX = "options.selectionToolbar.customActions.templates.sentenceAnalysis"

describe("contentLocaleFor", () => {
  it.each(SUPPORTED_UI_LOCALES)("gives a reader of %s's language its words", (locale) => {
    expect(contentLocaleFor(langCodeOfLocale(locale))).toBe(locale)
  })

  it("names each UI locale's language as the definitions do", () => {
    const byLocale: Partial<Record<string, string>> = LOCALE_TO_ISO6393
    for (const locale of SUPPORTED_UI_LOCALES) {
      const code = langCodeOfLocale(locale)
      expect(LANG_CODE_ISO6393_OPTIONS).toContain(code)
      expect(code).toBe(byLocale[locale] ?? byLocale[locale.split("-")[0]!])
    }
  })

  it("falls back to the UI language for a target language it has no words in", () => {
    // The i18n mock's UI language is en.
    expect(contentLocaleFor("fra")).toBe("en")
    expect(contentLocaleFor("yue")).toBe("en")
  })
})

describe("getSentenceAnalysisLabels", () => {
  // The i18n mock tags each key with the locale it was asked in.
  it("names every value in the locale asked for", () => {
    const labels = getSentenceAnalysisLabels("ja")
    expect(labels.roles.subject).toBe(`${SA_PREFIX}.roles.subject@ja`)
    expect(labels.clauses.attributive).toBe(`${SA_PREFIX}.clauses.attributive@ja`)
    expect(labels.forms["present-participle"]).toBe(`${SA_PREFIX}.forms.presentParticiple@ja`)
    expect(labels.obstacles["dummy-it"]).toBe(`${SA_PREFIX}.obstacles.dummyIt@ja`)
    expect(labels.trunk).toBe(`${SA_PREFIX}.trunkLabel@ja`)
  })

  it("builds a locale's words once", () => {
    expect(getSentenceAnalysisLabels("ko")).toBe(getSentenceAnalysisLabels("ko"))
    expect(getSentenceAnalysisLabels("ko")).not.toBe(getSentenceAnalysisLabels("ja"))
  })
})

describe("getImproveWritingLabels", () => {
  const IW_PREFIX = "options.selectionToolbar.customActions.templates.improveWriting"

  it("names every value in the locale asked for", () => {
    const labels = getImproveWritingLabels("ja")
    expect(labels.types["word-choice"]).toBe(`${IW_PREFIX}.types.wordChoice@ja`)
    expect(labels.types.good).toBe(`${IW_PREFIX}.types.good@ja`)
    expect(labels.tiers.awkward).toBe(`${IW_PREFIX}.tiers.awkward@ja`)
    expect(labels.hideFixes).toBe(`${IW_PREFIX}.hideFixesLabel@ja`)
    expect(labels.remove).toBe(`${IW_PREFIX}.removeLabel@ja`)
  })

  it("builds a locale's words once", () => {
    expect(getImproveWritingLabels("ko")).toBe(getImproveWritingLabels("ko"))
    expect(getImproveWritingLabels("ko")).not.toBe(getImproveWritingLabels("ja"))
  })
})
