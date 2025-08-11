export function migrate(oldConfig: any): any {
  const promptsConfig = {
    prompt: 'Read Frog: TRANSLATE_DEFAULT_PROMPT',
    patterns: [{
      id: 'Read Frog: TRANSLATE_DEFAULT_PROMPT',
      name: 'Read Frog: TRANSLATE_DEFAULT_PROMPT',
      prompt: `Treat input as plain text input and translate it into {{targetLang}}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes.
Input:
{{input}}
`,
    }],
  }

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      promptsConfig,
    },
  }
}
