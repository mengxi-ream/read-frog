/**
 * Migration script from v055 to v056
 * Adds selectionToolbar.customFeatures with default dictionary feature
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const dictionaryProviderId
    = oldConfig.selectionToolbar?.features?.vocabularyInsight?.providerId

  const customFeatures = dictionaryProviderId
    ? [
        {
          id: "default-dictionary",
          name: "Dictionary",
          enabled: true,
          icon: "tabler:book-2",
          providerId: dictionaryProviderId,
          systemPrompt:
        "You are a dictionary assistant for language learners. Given a term and its surrounding context, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLang}}.",
          prompt: "Term: {{selection}}\nContext: {{context}}\nTarget language: {{targetLang}}",
          outputSchema: [
            { id: "default-dictionary-term", name: "Term", type: "string" },
            { id: "default-dictionary-definition", name: "Definition", type: "string" },
            { id: "default-dictionary-context", name: "Context", type: "string" },
            { id: "default-dictionary-examples", name: "Examples", type: "string" },
            { id: "default-dictionary-synonyms", name: "Synonyms", type: "string" },
            { id: "default-dictionary-antonyms", name: "Antonyms", type: "string" },
          ],
        },
      ]
    : []

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      customFeatures: oldConfig.selectionToolbar?.customFeatures ?? customFeatures,
    },
  }
}
