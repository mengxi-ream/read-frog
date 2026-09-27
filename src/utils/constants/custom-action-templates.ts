import type { SentenceAnalysisLayoutLabels } from "@read-frog/layout-engine/presets"
import type { GeneratedI18nStructure } from "#i18n"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import {
  buildDictionaryActionLayout,
  buildSentenceAnalysisActionLayout,
} from "@/utils/layout-host/slots"
import { createOutputSchemaField } from "./custom-action"

const T_PREFIX = "options.selectionToolbar.customActions.templates"
type I18nKey = keyof GeneratedI18nStructure

export interface CustomActionTemplate {
  id: string
  nameKey: string
  descriptionKey: string
  icon: string
  createAction: (providerId: string) => SelectionToolbarCustomAction
}

type CustomActionTemplateDefinition = Omit<CustomActionTemplate, "nameKey" | "descriptionKey"> & {
  nameKey: I18nKey
  descriptionKey: I18nKey
}

// Labels the sentence analysis card bakes in, in the current UI language.
// Also used when the options page restores that card.
export function getSentenceAnalysisLayoutLabels(): SentenceAnalysisLayoutLabels {
  return {
    roles: {
      subject: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.subject`),
      predicate: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.predicate`),
      object: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.object`),
      complement: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.complement`),
      attributive: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.attributive`),
      adverbial: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.adverbial`),
      appositive: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.appositive`),
      clause: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.clause`),
      connector: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.connector`),
      other: i18n.t(`${T_PREFIX}.sentenceAnalysis.roles.other`),
    },
    hard: i18n.t(`${T_PREFIX}.sentenceAnalysis.hardLabel`),
  }
}

export const CUSTOM_ACTION_TEMPLATES: CustomActionTemplate[] = [
  {
    id: "dictionary",
    nameKey: `${T_PREFIX}.dictionary.name`,
    descriptionKey: `${T_PREFIX}.dictionary.description`,
    icon: "tabler:book-2",
    createAction: (providerId: string): SelectionToolbarCustomAction => {
      const outputSchema = [
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldTerm`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldTermDescription`),
          "dictionary-term",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldPhonetic`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldPhoneticDescription`),
          "dictionary-phonetic",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldPartOfSpeech`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldPartOfSpeechDescription`),
          "dictionary-part-of-speech",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldDefinition`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldDefinitionDescription`),
          "dictionary-definition",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldSentence`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldSentenceDescription`),
          "dictionary-context",
        ),
        // Where the term stands in the sentence, as annotations for the card
        // to mark (a JSON array of {"text": …} quotes).
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldSentenceTerm`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldSentenceTermDescription`),
          "dictionary-context-term",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldSentenceTranslation`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldSentenceTranslationDescription`),
          "dictionary-context-translation",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.dictionary.fieldDifficulty`),
          "string",
          i18n.t(`${T_PREFIX}.dictionary.fieldDifficultyDescription`),
          "dictionary-difficulty",
        ),
      ]
      return {
        id: getRandomUUID(),
        name: i18n.t(`${T_PREFIX}.dictionary.name`),
        enabled: true,
        icon: "tabler:book-2",
        providerId,
        systemPrompt: i18n.t(`${T_PREFIX}.dictionary.systemPrompt`),
        prompt: i18n.t(`${T_PREFIX}.dictionary.prompt`),
        outputSchema,
        // The card names its fields, so it is built from this schema; the
        // preset always has the term and definition slots, so it is never null.
        layout: buildDictionaryActionLayout(outputSchema) ?? DEFAULT_LAYOUT,
      }
    },
  },
  {
    id: "sentence-analysis",
    nameKey: `${T_PREFIX}.sentenceAnalysis.name`,
    descriptionKey: `${T_PREFIX}.sentenceAnalysis.description`,
    icon: "tabler:highlight",
    createAction: (providerId: string): SelectionToolbarCustomAction => {
      // Field types are only string and number, so the annotations travel as a
      // JSON array inside a string field. Each one quotes a span of the
      // selection; the card parses them and anchors the quotes onto it.
      const outputSchema = [
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.sentenceAnalysis.fieldAnnotations`),
          "string",
          i18n.t(`${T_PREFIX}.sentenceAnalysis.fieldAnnotationsDescription`),
          "sentence-analysis-annotations",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.sentenceAnalysis.fieldTranslation`),
          "string",
          i18n.t(`${T_PREFIX}.sentenceAnalysis.fieldTranslationDescription`),
          "sentence-analysis-translation",
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.sentenceAnalysis.fieldStructure`),
          "string",
          i18n.t(`${T_PREFIX}.sentenceAnalysis.fieldStructureDescription`),
          "sentence-analysis-structure",
        ),
      ]
      return {
        id: getRandomUUID(),
        name: i18n.t(`${T_PREFIX}.sentenceAnalysis.name`),
        enabled: true,
        icon: "tabler:highlight",
        providerId,
        systemPrompt: i18n.t(`${T_PREFIX}.sentenceAnalysis.systemPrompt`),
        prompt: i18n.t(`${T_PREFIX}.sentenceAnalysis.prompt`),
        outputSchema,
        // Built from this schema like the dictionary card; the preset always
        // has the annotations slot, so it is never null.
        layout:
          buildSentenceAnalysisActionLayout(outputSchema, getSentenceAnalysisLayoutLabels()) ??
          DEFAULT_LAYOUT,
      }
    },
  },
  {
    id: "improve-writing",
    nameKey: `${T_PREFIX}.improveWriting.name`,
    descriptionKey: `${T_PREFIX}.improveWriting.description`,
    icon: "tabler:pencil-check",
    createAction: (providerId: string): SelectionToolbarCustomAction => ({
      id: getRandomUUID(),
      name: i18n.t(`${T_PREFIX}.improveWriting.name`),
      enabled: true,
      icon: "tabler:pencil-check",
      providerId,
      systemPrompt: i18n.t(`${T_PREFIX}.improveWriting.systemPrompt`),
      prompt: i18n.t(`${T_PREFIX}.improveWriting.prompt`),
      outputSchema: [
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.improveWriting.fieldErrorAnalysis`),
          "string",
          i18n.t(`${T_PREFIX}.improveWriting.fieldErrorAnalysisDescription`),
        ),
        createOutputSchemaField(
          i18n.t(`${T_PREFIX}.improveWriting.fieldImprovedVersion`),
          "string",
          i18n.t(`${T_PREFIX}.improveWriting.fieldImprovedVersionDescription`),
        ),
      ],
      layout: DEFAULT_LAYOUT,
    }),
  },
  {
    id: "blank",
    nameKey: `${T_PREFIX}.blank.name`,
    descriptionKey: `${T_PREFIX}.blank.description`,
    icon: "tabler:sparkles",
    createAction: (providerId: string): SelectionToolbarCustomAction => ({
      id: getRandomUUID(),
      name: i18n.t(`${T_PREFIX}.blank.name`),
      enabled: true,
      icon: "tabler:sparkles",
      providerId,
      systemPrompt: "",
      prompt: "",
      outputSchema: [
        createOutputSchemaField(
          i18n.t("options.selectionToolbar.customActions.form.defaultFieldName"),
        ),
      ],
      layout: DEFAULT_LAYOUT,
    }),
  },
] satisfies CustomActionTemplateDefinition[]
