/**
 * Sentence-level separator — deliberately different from the queue-level
 * BATCH_SEPARATOR ("%%") so that sentence-batched text can pass through the
 * background batch queue without delimiter collision.
 */
const SENTENCE_SEPARATOR = "@@"

/**
 * Join sentences into a single batch text using @@ separators.
 * The LLM naturally replicates the separator pattern in its output.
 */
export function buildLineByLineBatchText(sentences: string[]): string {
  return sentences.join(`\n${SENTENCE_SEPARATOR}\n`)
}

/**
 * Parse a batch translation result back into individual sentence translations.
 * Splits by @@ and filters out empty strings.
 */
export function parseLineByLineBatchResult(text: string): string[] {
  return text
    .split(SENTENCE_SEPARATOR)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
