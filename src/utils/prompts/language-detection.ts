import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LANG_CODE_TO_EN_NAME, langCodeISO6393Schema } from "@read-frog/definitions"
import z from "zod"

const supportedLanguageList = Object.entries(LANG_CODE_TO_EN_NAME)
  .map(([code, name]) => `- ${code}: ${name}`)
  .join("\n")

export function getLanguageDetectionSystemPrompt(): string {
  return `You are a language detection assistant. Your task is to identify the language of text and return ONLY the ISO 639-3 language code.

Rules:
- Return ONLY the language code (e.g., "eng" or "cmn" or "und")
- Do NOT include explanations, punctuation, or any other text
- Return "und" if the language is not in the supported list

Supported ISO 639-3 language codes:
${supportedLanguageList}`
}

export function normalizeLanguageDetectionOutput(rawOutput: string): string {
  return rawOutput.trim().toLowerCase().replace(/['"`,.\s]/g, "")
}

export function parseDetectedLanguageCode(rawOutput: string): LangCodeISO6393 | "und" | null {
  const cleanedCode = normalizeLanguageDetectionOutput(rawOutput)
  const parseResult = langCodeISO6393Schema.or(z.literal("und")).safeParse(cleanedCode)
  return parseResult.success ? parseResult.data : null
}
