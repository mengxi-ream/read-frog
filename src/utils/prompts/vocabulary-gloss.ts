import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"

export function getVocabularyGlossPrompt(words: string[], targetLangCode: LangCodeISO6393) {
  const targetLangName = LANG_CODE_TO_EN_NAME[targetLangCode]

  const systemPrompt = `You are a concise bilingual dictionary. For each English word you receive, provide its single most common meaning in ${targetLangName}, as short as possible (a word or a very short phrase, no punctuation, no pronunciation, no part of speech).

Respond with ONLY a valid JSON object mapping each input word to its ${targetLangName} gloss. No markdown, no code fences, no extra text.`

  const prompt = JSON.stringify(words)

  return { systemPrompt, prompt }
}

/** Parse the LLM response into a word -> gloss record. Tolerates code fences. */
export function parseVocabularyGlossResponse(text: string): Record<string, string> {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
  const parsed: unknown = JSON.parse(stripped)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Vocabulary gloss response is not a JSON object")
  }
  const result: Record<string, string> = {}
  for (const [word, gloss] of Object.entries(parsed)) {
    if (typeof gloss === "string" && gloss.trim()) {
      result[word.toLowerCase()] = gloss.trim()
    }
  }
  return result
}
