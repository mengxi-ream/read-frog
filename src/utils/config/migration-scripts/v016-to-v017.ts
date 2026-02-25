export function migrate(oldConfig: any): any {
  const isUsingDefaultPrompt = oldConfig.translate.promptsConfig.prompt === "Read Frog: TRANSLATE_DEFAULT_PROMPT"

  const newPromptConfig = {
    ...oldConfig.translate.promptsConfig,
    prompt: isUsingDefaultPrompt ? "default" : oldConfig.translate.promptsConfig.prompt,
    patterns: oldConfig.translate.promptsConfig.patterns.map((pattern: any) => {
      if (pattern.id === "Read Frog: TRANSLATE_DEFAULT_PROMPT") {
        return {
          id: "default",
          name: "default",
          prompt: `You are a professional {{targetLang}} native translator who needs to fluently translate text into {{targetLang}}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

Translate to {{targetLang}}:
\`\`\`
{{input}}
\`\`\`
`,
        }
      }
      return pattern
    }),
  }

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      promptsConfig: newPromptConfig,
    },
  }
}
