import type { GeneratedI18nStructure } from "#i18n"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import {
  buildDictionaryActionLayout,
  buildImproveWritingActionLayout,
  buildSentenceAnalysisActionLayout,
} from "@/utils/layout-host/slots"
import { createOutputSchemaField } from "./custom-action"

const T_PREFIX = "options.selectionToolbar.customActions.templates"
const SA_PREFIX = `${T_PREFIX}.sentenceAnalysis`
const IW_PREFIX = `${T_PREFIX}.improveWriting`
const IMPROVE_WRITING_ICON = "streamline-color:ai-edit-spark-flat"
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

// An action as a preset defines it, before its card is built: the built-in
// actions rename the field ids first and build the card for those.
export type CustomActionDefinition = Omit<SelectionToolbarCustomAction, "layout">

export function createDictionaryDefinition(providerId: string): CustomActionDefinition {
  return {
    id: getRandomUUID(),
    name: i18n.t(`${T_PREFIX}.dictionary.name`),
    enabled: true,
    icon: "streamline-color:dictionary-language-book-flat",
    providerId,
    systemPrompt: i18n.t(`${T_PREFIX}.dictionary.systemPrompt`),
    prompt: i18n.t(`${T_PREFIX}.dictionary.prompt`),
    outputSchema: [
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
    ],
  }
}

// The prompt is English in every UI language: its wording is what keeps
// models' annotations valid and consistent (tested across models), so it is
// not translated. It names the two fields, whose names are localized, and asks
// for notes and the translation in the target language.
export function createSentenceAnalysisDefinition(providerId: string): CustomActionDefinition {
  const annotations = i18n.t(`${SA_PREFIX}.fieldAnnotations`)
  const translation = i18n.t(`${SA_PREFIX}.fieldTranslation`)
  return {
    id: getRandomUUID(),
    name: i18n.t(`${SA_PREFIX}.name`),
    enabled: true,
    icon: "streamline-color:search-visual-flat",
    providerId,
    systemPrompt: i18n.t(`${SA_PREFIX}.systemPrompt`, [annotations, translation]),
    prompt: i18n.t(`${SA_PREFIX}.prompt`),
    // Field types are only string and number, so the annotations travel as a
    // JSON array inside a string field. Each one quotes a span of the
    // selection; the card parses them and anchors the quotes onto it.
    outputSchema: [
      createOutputSchemaField(
        annotations,
        "string",
        i18n.t(`${SA_PREFIX}.fieldAnnotationsDescription`),
        "sentence-analysis-annotations",
      ),
      createOutputSchemaField(
        translation,
        "string",
        i18n.t(`${SA_PREFIX}.fieldTranslationDescription`),
        "sentence-analysis-translation",
      ),
    ],
  }
}

// Like Sentence Analysis, the prompt and the field descriptions are English in
// every UI language, and name the fields, whose names are localized. The model
// judges the setting first (its first field), then marks the selection and
// rewrites it for that setting, writing its words in the target language.
export function createImproveWritingDefinition(providerId: string): CustomActionDefinition {
  const setting = i18n.t(`${IW_PREFIX}.fieldSetting`)
  const annotations = i18n.t(`${IW_PREFIX}.fieldAnnotations`)
  const improved = i18n.t(`${IW_PREFIX}.fieldImproved`)
  const summary = i18n.t(`${IW_PREFIX}.fieldSummary`)
  return {
    id: getRandomUUID(),
    name: i18n.t(`${IW_PREFIX}.name`),
    enabled: true,
    icon: IMPROVE_WRITING_ICON,
    providerId,
    systemPrompt: i18n.t(`${IW_PREFIX}.systemPrompt`, [setting, annotations, improved, summary]),
    prompt: i18n.t(`${IW_PREFIX}.prompt`),
    // In the order the card fills: the setting it judges everything by, the
    // marks (a JSON array inside a string field, like Sentence Analysis's),
    // the rewrite, and the one-line summary.
    outputSchema: [
      createOutputSchemaField(
        setting,
        "string",
        i18n.t(`${IW_PREFIX}.fieldSettingDescription`),
        "improve-writing-setting",
      ),
      createOutputSchemaField(
        annotations,
        "string",
        i18n.t(`${IW_PREFIX}.fieldAnnotationsDescription`),
        "improve-writing-annotations",
      ),
      createOutputSchemaField(
        improved,
        "string",
        i18n.t(`${IW_PREFIX}.fieldImprovedDescription`),
        "improve-writing-improved",
      ),
      createOutputSchemaField(
        summary,
        "string",
        i18n.t(`${IW_PREFIX}.fieldSummaryDescription`),
        "improve-writing-summary",
      ),
    ],
  }
}

export const CUSTOM_ACTION_TEMPLATES: CustomActionTemplate[] = [
  {
    id: "dictionary",
    nameKey: `${T_PREFIX}.dictionary.name`,
    descriptionKey: `${T_PREFIX}.dictionary.description`,
    icon: "streamline-color:dictionary-language-book-flat",
    createAction: (providerId: string): SelectionToolbarCustomAction => {
      const action = createDictionaryDefinition(providerId)
      // The card names its fields, so it is built from this schema; the
      // preset always has the term and definition slots, so it is never null.
      return {
        ...action,
        layout: buildDictionaryActionLayout(action.outputSchema) ?? DEFAULT_LAYOUT,
      }
    },
  },
  {
    id: "sentence-analysis",
    nameKey: `${SA_PREFIX}.name`,
    descriptionKey: `${SA_PREFIX}.description`,
    icon: "streamline-color:search-visual-flat",
    createAction: (providerId: string): SelectionToolbarCustomAction => {
      const action = createSentenceAnalysisDefinition(providerId)
      // Built from this schema like the dictionary card; the preset always
      // has the annotations slot, so it is never null.
      return {
        ...action,
        layout: buildSentenceAnalysisActionLayout(action.outputSchema) ?? DEFAULT_LAYOUT,
      }
    },
  },
  {
    id: "improve-writing",
    nameKey: `${IW_PREFIX}.name`,
    descriptionKey: `${IW_PREFIX}.description`,
    icon: IMPROVE_WRITING_ICON,
    createAction: (providerId: string): SelectionToolbarCustomAction => {
      const action = createImproveWritingDefinition(providerId)
      // Built from this schema like the other cards; the preset always has
      // the annotations slot, so it is never null.
      return {
        ...action,
        layout: buildImproveWritingActionLayout(action.outputSchema) ?? DEFAULT_LAYOUT,
      }
    },
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
      // Not empty: the Built-in AI, which new actions default to, rejects a
      // request without a prompt.
      prompt: i18n.t(`${T_PREFIX}.blank.prompt`),
      outputSchema: [
        createOutputSchemaField(
          i18n.t("options.selectionToolbar.customActions.form.defaultFieldName"),
        ),
      ],
      layout: DEFAULT_LAYOUT,
    }),
  },
] satisfies CustomActionTemplateDefinition[]
