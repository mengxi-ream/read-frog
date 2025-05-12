export const getTranslateLinePrompt = (
  targetLang: string,
  input: string,
) => `Treat input as plain text input and translate it into ${targetLang}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes.
Input:
${input}
`;
