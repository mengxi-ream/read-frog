/**
 * Segment a text into sentences using Intl.Segmenter.
 * If Intl.Segmenter is unavailable (e.g., Firefox < 125), returns the text as-is.
 */
export function segmentSentences(text: string): string[] {
  if (!text || !text.trim()) {
    return []
  }

  if (typeof Intl === "undefined" || !Intl.Segmenter) {
    return [text]
  }

  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" })
    const segments = [...segmenter.segment(text)]
      .map(s => s.segment.trim())
      .filter(s => s.length > 0)

    return segments.length > 0 ? segments : [text]
  }
  catch {
    return [text]
  }
}
