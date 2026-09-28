import type { LangCodeISO6393 } from "@read-frog/definitions"
import type {
  ImproveWritingLayoutLabels,
  SentenceAnalysisLayoutLabels,
} from "@read-frog/layout-engine/presets"
import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { getUiLocale, translateIn } from "@/utils/i18n"

// A result card speaks the reader's language, not the UI's. The model writes
// its notes and translation in the target language (`language.targetCode`,
// the prompt's {{targetLanguage}}), so the card's own words — the sentence
// analysis card's role names, clause chips and tags — are in that language
// too: the model only writes language-neutral values ("attributive"), and
// they are named here. The extension has words in its UI languages; a target
// language outside them gets the UI language's, which the reader reads too.

// The language each UI locale is written in.
const LANG_CODE_OF_UI_LOCALE: Readonly<Record<SupportedUiLocale, LangCodeISO6393>> = {
  en: "eng",
  "zh-CN": "cmn",
  "zh-TW": "cmn-Hant",
  ja: "jpn",
  ko: "kor",
  ru: "rus",
  tr: "tur",
  vi: "vie",
  es: "spa",
  az: "azj",
}

const UI_LOCALE_OF_LANG_CODE = new Map(
  Object.entries(LANG_CODE_OF_UI_LOCALE).map(([locale, code]) => [
    code,
    locale as SupportedUiLocale,
  ]),
)

// The locale whose words a card shows a reader of `targetCode`.
export function contentLocaleFor(targetCode: LangCodeISO6393): SupportedUiLocale {
  return UI_LOCALE_OF_LANG_CODE.get(targetCode) ?? getUiLocale()
}

// The language a locale's words are in.
export function langCodeOfLocale(locale: SupportedUiLocale): LangCodeISO6393 {
  return LANG_CODE_OF_UI_LOCALE[locale]
}

const SA_PREFIX = "options.selectionToolbar.customActions.templates.sentenceAnalysis"

function buildSentenceAnalysisLabels(locale: SupportedUiLocale): SentenceAnalysisLayoutLabels {
  const t = (key: Parameters<typeof translateIn>[1]) => translateIn(locale, key)
  return {
    roles: {
      subject: t(`${SA_PREFIX}.roles.subject`),
      predicate: t(`${SA_PREFIX}.roles.predicate`),
      object: t(`${SA_PREFIX}.roles.object`),
      complement: t(`${SA_PREFIX}.roles.complement`),
      attributive: t(`${SA_PREFIX}.roles.attributive`),
      adverbial: t(`${SA_PREFIX}.roles.adverbial`),
      appositive: t(`${SA_PREFIX}.roles.appositive`),
      connector: t(`${SA_PREFIX}.roles.connector`),
    },
    clauses: {
      subject: t(`${SA_PREFIX}.clauses.subject`),
      object: t(`${SA_PREFIX}.clauses.object`),
      complement: t(`${SA_PREFIX}.clauses.complement`),
      attributive: t(`${SA_PREFIX}.clauses.attributive`),
      adverbial: t(`${SA_PREFIX}.clauses.adverbial`),
      appositive: t(`${SA_PREFIX}.clauses.appositive`),
      clause: t(`${SA_PREFIX}.clauses.clause`),
    },
    adverbialClauses: {
      time: t(`${SA_PREFIX}.adverbialClauses.time`),
      place: t(`${SA_PREFIX}.adverbialClauses.place`),
      cause: t(`${SA_PREFIX}.adverbialClauses.cause`),
      condition: t(`${SA_PREFIX}.adverbialClauses.condition`),
      concession: t(`${SA_PREFIX}.adverbialClauses.concession`),
      purpose: t(`${SA_PREFIX}.adverbialClauses.purpose`),
      result: t(`${SA_PREFIX}.adverbialClauses.result`),
      manner: t(`${SA_PREFIX}.adverbialClauses.manner`),
      comparison: t(`${SA_PREFIX}.adverbialClauses.comparison`),
    },
    forms: {
      infinitive: t(`${SA_PREFIX}.forms.infinitive`),
      gerund: t(`${SA_PREFIX}.forms.gerund`),
      "present-participle": t(`${SA_PREFIX}.forms.presentParticiple`),
      "past-participle": t(`${SA_PREFIX}.forms.pastParticiple`),
    },
    senses: {
      time: t(`${SA_PREFIX}.senses.time`),
      place: t(`${SA_PREFIX}.senses.place`),
      cause: t(`${SA_PREFIX}.senses.cause`),
      condition: t(`${SA_PREFIX}.senses.condition`),
      concession: t(`${SA_PREFIX}.senses.concession`),
      purpose: t(`${SA_PREFIX}.senses.purpose`),
      result: t(`${SA_PREFIX}.senses.result`),
      manner: t(`${SA_PREFIX}.senses.manner`),
      comparison: t(`${SA_PREFIX}.senses.comparison`),
    },
    obstacles: {
      inversion: t(`${SA_PREFIX}.obstacles.inversion`),
      fronting: t(`${SA_PREFIX}.obstacles.fronting`),
      ellipsis: t(`${SA_PREFIX}.obstacles.ellipsis`),
      passive: t(`${SA_PREFIX}.obstacles.passive`),
      subjunctive: t(`${SA_PREFIX}.obstacles.subjunctive`),
      parenthesis: t(`${SA_PREFIX}.obstacles.parenthesis`),
      "dummy-it": t(`${SA_PREFIX}.obstacles.dummyIt`),
      "postponed-subject": t(`${SA_PREFIX}.obstacles.postponedSubject`),
      cleft: t(`${SA_PREFIX}.obstacles.cleft`),
      comparison: t(`${SA_PREFIX}.obstacles.comparison`),
      negation: t(`${SA_PREFIX}.obstacles.negation`),
      split: t(`${SA_PREFIX}.obstacles.split`),
      idiom: t(`${SA_PREFIX}.obstacles.idiom`),
    },
    restore: t(`${SA_PREFIX}.restoreLabel`),
    hard: t(`${SA_PREFIX}.hardLabel`),
    trunk: t(`${SA_PREFIX}.trunkLabel`),
    slashes: t(`${SA_PREFIX}.slashesLabel`),
  }
}

// Built once per locale: a card re-renders on every chunk of a streamed answer.
const sentenceAnalysisLabelsByLocale = new Map<SupportedUiLocale, SentenceAnalysisLayoutLabels>()

// The sentence analysis card's words in `locale`.
export function getSentenceAnalysisLabels(locale: SupportedUiLocale): SentenceAnalysisLayoutLabels {
  let labels = sentenceAnalysisLabelsByLocale.get(locale)
  if (!labels) {
    labels = buildSentenceAnalysisLabels(locale)
    sentenceAnalysisLabelsByLocale.set(locale, labels)
  }
  return labels
}

const IW_PREFIX = "options.selectionToolbar.customActions.templates.improveWriting"

function buildImproveWritingLabels(locale: SupportedUiLocale): ImproveWritingLayoutLabels {
  const t = (key: Parameters<typeof translateIn>[1]) => translateIn(locale, key)
  return {
    types: {
      spelling: t(`${IW_PREFIX}.types.spelling`),
      grammar: t(`${IW_PREFIX}.types.grammar`),
      punctuation: t(`${IW_PREFIX}.types.punctuation`),
      "word-choice": t(`${IW_PREFIX}.types.wordChoice`),
      logic: t(`${IW_PREFIX}.types.logic`),
      unnatural: t(`${IW_PREFIX}.types.unnatural`),
      register: t(`${IW_PREFIX}.types.register`),
      clarity: t(`${IW_PREFIX}.types.clarity`),
      good: t(`${IW_PREFIX}.types.good`),
    },
    tiers: {
      error: t(`${IW_PREFIX}.tiers.error`),
      awkward: t(`${IW_PREFIX}.tiers.awkward`),
      good: t(`${IW_PREFIX}.tiers.good`),
    },
    hideFixes: t(`${IW_PREFIX}.hideFixesLabel`),
    hiddenHint: t(`${IW_PREFIX}.hiddenHintLabel`),
    showImproved: t(`${IW_PREFIX}.showImprovedLabel`),
    improved: t(`${IW_PREFIX}.improvedLabel`),
    copy: t(`${IW_PREFIX}.copyLabel`),
    unchanged: t(`${IW_PREFIX}.unchangedLabel`),
    remove: t(`${IW_PREFIX}.removeLabel`),
  }
}

const improveWritingLabelsByLocale = new Map<SupportedUiLocale, ImproveWritingLayoutLabels>()

// The Improve Writing card's words in `locale`.
export function getImproveWritingLabels(locale: SupportedUiLocale): ImproveWritingLayoutLabels {
  let labels = improveWritingLabelsByLocale.get(locale)
  if (!labels) {
    labels = buildImproveWritingLabels(locale)
    improveWritingLabelsByLocale.set(locale, labels)
  }
  return labels
}
