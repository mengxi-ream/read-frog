/**
 * Language detection prompt and output parsing.
 *
 * The output schema requests a `reason` field *before* `code` ("soft reasoning"):
 * autoregressive models emit the `reason` tokens first, so `code` is conditioned
 * on that reasoning — a lightweight chain-of-thought that lifts accuracy on fast
 * or instruction-following-weak models. Field order matters: `reason` after
 * `code` would be a post-hoc justification with no accuracy benefit.
 *
 * Hard reasoning (thinking mode) is intentionally not used: detection sits on
 * the latency-sensitive TTS path, the task is simple, and reasoning toggles are
 * provider-specific while this prompt must stay provider-agnostic.
 */
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LANG_CODE_TO_EN_NAME, langCodeISO6393Schema } from "@read-frog/definitions"
import z from "zod"
import { logger } from "../logger"

const supportedLanguageList = Object.entries(LANG_CODE_TO_EN_NAME)
  .map(([code, name]) => `- ${code}: ${name}`)
  .join("\n")

export const languageDetectionOutputSchema = z.object({
  // Optional for lenient validation
  reason: z.string().optional().describe("The reason why LLM pick this code. Just for soft reasoning. No need to consume."),
  code: z.union([langCodeISO6393Schema, z.literal("und")]),
})

export type LanguageDetectionOutput = z.infer<typeof languageDetectionOutputSchema>

export function getLanguageDetectionSystemPrompt(): string {
  return `You are a language detection assistant. Your task is to identify the language of text and to give its ISO 639-3 language code.

## Output format

You should give a raw JSON string which satisfies following schema:

\`\`\`typescript
type Output = {
  /** The reason why you pick this code. Be concise. */
  reason: string
  /** ISO 639-3 code */
  code: string
}

\`\`\`

## Example

User input:

衔远山，吞长江，浩浩汤汤，横无际涯。

Your output:

{
  "reason": "This is a Simplified Chinese sentence, so the code should be \\"cmn\\".",
  "code": "cmn"
}

## Rules

- Return ONLY raw JSON string
- Give "und" as code if the language is not in the supported list

## Supported ISO 639-3 language codes

${supportedLanguageList}`
}

const LEADING_CODE_FENCE_PATTERN = /^```[ \t]*\w*[ \t]*\n?/
const TRAILING_CODE_FENCE_PATTERN = /\s*```$/

export function normalizeLanguageDetectionOutput(rawOutput: string): string {
  return rawOutput
    .trim()
    .replace(LEADING_CODE_FENCE_PATTERN, "")
    .replace(TRAILING_CODE_FENCE_PATTERN, "")
    .trim()
    .toLowerCase()
}

export function parseDetectedLanguageCode(rawOutput: string): LangCodeISO6393 | "und" | null {
  const cleanedOutput = normalizeLanguageDetectionOutput(rawOutput)
  let data: unknown

  try {
    data = JSON.parse(cleanedOutput)
  }
  catch {
    logger.warn("Failed to parse language detection output. Fallback to null.", rawOutput)
    return null
  }

  const parseResult = languageDetectionOutputSchema.safeParse(data)

  if (parseResult.success) {
    return parseResult.data.code
  }
  else {
    logger.warn("Failed to parse language detection output. Fallback to null.", data)
    return null
  }
}
