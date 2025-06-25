export function getTranslateLinePrompt(targetLang: string, input: string) {
  return `Translate this and provide the original English for key terms in parentheses, like this: "中文 (English)". Treat input as plain text input and translate it into ${targetLang}. NO explanations. NO notes.
Input:
${input}
`
}
