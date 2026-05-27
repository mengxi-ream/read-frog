import { BATCH_SEPARATOR } from "../../../constants/prompt"

/**
 * Join sentences into a single batch text using %% separators,
 * matching the format expected by the batch translation prompt.
 */
export function buildLineByLineBatchText(sentences: string[]): string {
  return sentences.join(`\n\n${BATCH_SEPARATOR}\n\n`)
}

/**
 * Parse a batch translation result back into individual sentence translations.
 * Splits by %% and filters out empty strings.
 */
export function parseLineByLineBatchResult(text: string): string[] {
  return text
    .split(BATCH_SEPARATOR)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
