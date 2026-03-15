import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { createOutputSchemaField } from "./custom-action"

const T_PREFIX = "options.floatingButtonAndToolbar.selectionToolbar.customActions.templates"

export interface CustomActionTemplate {
  id: string
  nameKey: string
  descriptionKey: string
  icon: string
  createAction: (providerId: string) => SelectionToolbarCustomAction
}

export const CUSTOM_ACTION_TEMPLATES: CustomActionTemplate[] = [
  {
    id: "dictionary",
    nameKey: `${T_PREFIX}.dictionary.name`,
    descriptionKey: `${T_PREFIX}.dictionary.description`,
    icon: "tabler:book-2",
    createAction: (providerId: string): SelectionToolbarCustomAction => ({
      id: crypto.randomUUID(),
      name: i18n.t(`${T_PREFIX}.dictionary.name`),
      enabled: true,
      icon: "tabler:book-2",
      providerId,
      systemPrompt: i18n.t(`${T_PREFIX}.dictionary.systemPrompt`),
      prompt: i18n.t(`${T_PREFIX}.dictionary.prompt`),
      outputSchema: [
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldTerm`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldTermDescription`), "dictionary-term", true),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldPhonetic`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldPhoneticDescription`), "dictionary-phonetic"),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldPartOfSpeech`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldPartOfSpeechDescription`), "dictionary-part-of-speech"),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldDefinition`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldDefinitionDescription`), "dictionary-definition"),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldParagraphs`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldParagraphsDescription`), "dictionary-context", true),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldParagraphsTranslation`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldParagraphsTranslationDescription`), "dictionary-context-translation"),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.dictionary.fieldDifficulty`), "string", i18n.t(`${T_PREFIX}.dictionary.fieldDifficultyDescription`), "dictionary-difficulty"),
      ],
    }),
  },
  {
    id: "improve-writing",
    nameKey: `${T_PREFIX}.improveWriting.name`,
    descriptionKey: `${T_PREFIX}.improveWriting.description`,
    icon: "tabler:pencil-check",
    createAction: (providerId: string): SelectionToolbarCustomAction => ({
      id: crypto.randomUUID(),
      name: i18n.t(`${T_PREFIX}.improveWriting.name`),
      enabled: true,
      icon: "tabler:pencil-check",
      providerId,
      systemPrompt: i18n.t(`${T_PREFIX}.improveWriting.systemPrompt`),
      prompt: i18n.t(`${T_PREFIX}.improveWriting.prompt`),
      outputSchema: [
        createOutputSchemaField(i18n.t(`${T_PREFIX}.improveWriting.fieldErrorAnalysis`), "string", i18n.t(`${T_PREFIX}.improveWriting.fieldErrorAnalysisDescription`)),
        createOutputSchemaField(i18n.t(`${T_PREFIX}.improveWriting.fieldImprovedVersion`), "string", i18n.t(`${T_PREFIX}.improveWriting.fieldImprovedVersionDescription`)),
      ],
    }),
  },
  {
    id: "blank",
    nameKey: `${T_PREFIX}.blank.name`,
    descriptionKey: `${T_PREFIX}.blank.description`,
    icon: "tabler:sparkles",
    createAction: (providerId: string): SelectionToolbarCustomAction => ({
      id: crypto.randomUUID(),
      name: i18n.t(`${T_PREFIX}.blank.name`),
      enabled: true,
      icon: "tabler:sparkles",
      providerId,
      systemPrompt: "",
      prompt: "",
      outputSchema: [
        createOutputSchemaField(i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.defaultFieldName")),
      ],
    }),
  },
]
