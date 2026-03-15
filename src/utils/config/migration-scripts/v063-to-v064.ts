/**
 * Migration script from v063 to v064
 * - Renames translate/video subtitle prompt tokens:
 *   - {{targetLang}} -> {{targetLanguage}}
 *   - {{title}} -> {{webTitle}}
 *   - {{summary}} -> {{webSummary}}
 * - Renames selection toolbar custom action prompt tokens:
 *   - {{context}} -> {{paragraphs}}
 *   - {{targetLang}} -> {{targetLanguage}}
 *   - {{title}} -> {{webTitle}}
 * - Updates dictionary template wording from "context" to "paragraphs"
 * - Renames dictionary output field labels:
 *   - Context -> Paragraphs
 *   - Context Translation -> Paragraphs Translation
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
function replaceTranslatePromptTokens(text: any): any {
  if (typeof text !== "string") {
    return text
  }

  return text
    .replaceAll("{{targetLang}}", "{{targetLanguage}}")
    .replaceAll("{{title}}", "{{webTitle}}")
    .replaceAll("{{summary}}", "{{webSummary}}")
}

function replaceCustomActionPromptTokens(text: any): any {
  if (typeof text !== "string") {
    return text
  }

  return text
    .replaceAll("{{context}}", "{{paragraphs}}")
    .replaceAll("{{targetLang}}", "{{targetLanguage}}")
    .replaceAll("{{title}}", "{{webTitle}}")
}

function migrateCustomPromptsConfig(config: any): any {
  if (!config || !Array.isArray(config.patterns)) {
    return config
  }

  return {
    ...config,
    patterns: config.patterns.map((pattern: any) => ({
      ...pattern,
      systemPrompt: replaceTranslatePromptTokens(pattern.systemPrompt),
      prompt: replaceTranslatePromptTokens(pattern.prompt),
    })),
  }
}

function isDictionaryLikeAction(action: any): boolean {
  return Array.isArray(action?.outputSchema)
    && action.outputSchema.some((field: any) =>
      field?.id === "dictionary-context"
      || field?.id === "default-dictionary-context"
      || field?.id === "dictionary-context-translation"
      || field?.id === "default-dictionary-context-translation",
    )
}

function migrateDictionaryText(text: any): any {
  if (typeof text !== "string") {
    return text
  }

  return text
    .replaceAll("surrounding context", "surrounding paragraphs")
    .replaceAll("provided context", "provided paragraphs")
    .replaceAll("Keep Context short and directly tied to the selected text.", "Keep Paragraphs exactly as provided in the prompt.")
    .replaceAll("- Context:", "- Paragraphs:")
    .replaceAll("- Context Translation:", "- Paragraphs Translation:")
    .replaceAll("\nContext: {{paragraphs}}", "\nParagraphs: {{paragraphs}}")
    .replaceAll("根据给定的词语及其上下文，生成简洁的词典条目，匹配所需的输出对象。", "根据给定的词语及其周围段落，生成简洁的词典条目，匹配所需的输出对象。")
    .replaceAll("聚焦于最匹配所提供上下文的含义。", "聚焦于最匹配所提供段落内容的含义。")
    .replaceAll("保持语境简短，直接关联选中的文本。", "保持段落内容与提示词一致，不要改写。")
    .replaceAll("- 语境：", "- 段落内容：")
    .replaceAll("- 语境翻译：", "- 段落翻译：")
    .replaceAll("\n上下文：{{paragraphs}}", "\n段落内容：{{paragraphs}}")
}

function migrateDictionaryField(field: any): any {
  if (field?.id === "dictionary-context" || field?.id === "default-dictionary-context") {
    return {
      ...field,
      name: field.name === "语境"
        ? "段落内容"
        : field.name === "Context"
          ? "Paragraphs"
          : field.name,
      description: typeof field.description === "string"
        ? field.description
            .replaceAll("The context in the prompt above, don't change it.", "The paragraphs from the prompt above. Do not rewrite them.")
            .replaceAll("The paragraphs in the prompt above, don't change them.", "The paragraphs from the prompt above. Do not rewrite them.")
            .replaceAll("上方提示词中的语境，请勿修改。", "使用上方提示词中的原始段落内容，不要改写。")
            .replaceAll("上方提示词中的段落内容，请勿修改。", "使用上方提示词中的原始段落内容，不要改写。")
        : field.description,
    }
  }

  if (field?.id === "dictionary-context-translation" || field?.id === "default-dictionary-context-translation") {
    return {
      ...field,
      name: field.name === "语境翻译"
        ? "段落翻译"
        : field.name === "Context Translation"
          ? "Paragraphs Translation"
          : field.name,
      description: typeof field.description === "string"
        ? field.description
            .replaceAll("The translation of the context.", "The translation of the paragraphs.")
            .replaceAll("语境的翻译。", "段落内容的翻译。")
        : field.description,
    }
  }

  return field
}

function migrateCustomActions(actions: any): any {
  if (!Array.isArray(actions)) {
    return actions
  }

  return actions.map((action: any) => {
    const migratedAction = {
      ...action,
      systemPrompt: replaceCustomActionPromptTokens(action.systemPrompt),
      prompt: replaceCustomActionPromptTokens(action.prompt),
      outputSchema: Array.isArray(action.outputSchema)
        ? action.outputSchema.map((field: any) => ({
            ...field,
            description: replaceCustomActionPromptTokens(field.description),
          }))
        : action.outputSchema,
    }

    if (!isDictionaryLikeAction(migratedAction)) {
      return migratedAction
    }

    return {
      ...migratedAction,
      systemPrompt: migrateDictionaryText(migratedAction.systemPrompt),
      prompt: migrateDictionaryText(migratedAction.prompt),
      outputSchema: Array.isArray(migratedAction.outputSchema)
        ? migratedAction.outputSchema.map(migrateDictionaryField)
        : migratedAction.outputSchema,
    }
  })
}

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      customPromptsConfig: migrateCustomPromptsConfig(oldConfig?.translate?.customPromptsConfig),
    },
    selectionToolbar: {
      ...oldConfig?.selectionToolbar,
      customActions: migrateCustomActions(oldConfig?.selectionToolbar?.customActions),
    },
    videoSubtitles: {
      ...oldConfig?.videoSubtitles,
      customPromptsConfig: migrateCustomPromptsConfig(oldConfig?.videoSubtitles?.customPromptsConfig),
    },
  }
}
