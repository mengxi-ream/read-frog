import {
  BATCH_SEPARATOR,
  BATCH_SEPARATOR_LINE_PATTERN,
  DEFAULT_BATCH_TRANSLATE_PROMPT,
  NUMBERED_BATCH_TRANSLATE_PROMPT,
} from "@/utils/constants/prompt"

/**
 * How a batch of texts travels as one model request: the rules appended to the
 * system prompt, how the texts are joined into one input, and how the reply is
 * split back into one translation per text. The three only work together, so
 * they live together; a pipeline picks one format for its prompt builder and
 * its queue alike (`PAGE_BATCH_FORMAT`, `SUBTITLE_BATCH_FORMAT`).
 *
 * `parse` does not need to be strict about the count: BatchQueue refuses a
 * reply with the wrong number of segments, retries the batch and then sends
 * each text alone. A reply it cannot read is best returned as no segments.
 */
export interface BatchFormat {
  readonly prompt: string
  join: (texts: readonly string[]) => string
  parse: (reply: string) => string[]
}

export function parseBatchResult(result: string): string[] {
  return result
    .trim()
    .split(BATCH_SEPARATOR_LINE_PATTERN)
    .map((t) => t.trim())
}

/** Texts separated by a line holding only `%%`. */
export const SEPARATED_BATCH_FORMAT: BatchFormat = {
  prompt: DEFAULT_BATCH_TRANSLATE_PROMPT,
  join: (texts) => texts.join(`\n\n${BATCH_SEPARATOR}\n\n`),
  parse: parseBatchResult,
}

const SEGMENT_MARKER_PATTERN = /^[ \t]*\[(\d+)\][ \t]?/m

/**
 * A segment runs from its `[n]` at the start of a line to the next one, so a
 * two-line text stays one segment. Markers out of order, or text before the
 * first one, give no segments. A reply with no marker at all is one segment,
 * as a `%%` reply with no separator is: models often answer a batch of one
 * that way. A line holding only `%%` is dropped: a custom prompt that asks for
 * `%%` separators gets them added between numbered segments.
 */
export function parseNumberedBatchResult(result: string): string[] {
  const parts = result.trim().split(SEGMENT_MARKER_PATTERN)
  if (parts.length === 1) return [parts[0]!]
  if (parts[0]!.trim() !== "") return []
  const segments: string[] = []
  for (let i = 1; i < parts.length; i += 2) {
    if (Number(parts[i]) !== segments.length + 1) return []
    const lines = parts[i + 1]!.split(/\r?\n/).filter((line) => line.trim() !== BATCH_SEPARATOR)
    segments.push(lines.join("\n").trim())
  }
  return segments
}

/** Each text on its own line, starting with its number: `[1] …`, `[2] …`. */
export const NUMBERED_BATCH_FORMAT: BatchFormat = {
  prompt: NUMBERED_BATCH_TRANSLATE_PROMPT,
  join: (texts) => texts.map((text, i) => `[${i + 1}] ${text}`).join("\n"),
  parse: parseNumberedBatchResult,
}
