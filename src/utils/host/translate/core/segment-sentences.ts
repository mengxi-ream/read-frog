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
    const rawSegments = [...segmenter.segment(text)].map(s => s.segment)

    // Intl.Segmenter includes boundary whitespace as trailing space on the
    // preceding segment (e.g. "Hello. " + "World.").  Trimming drops that
    // space, which makes line-by-line mode render source sentences
    // concatenated as "Hello.World.".  Preserve a single trailing space on
    // every non-last segment that originally had one.
    const segments: string[] = []
    for (let i = 0; i < rawSegments.length; i++) {
      const trimmed = rawSegments[i].trim()
      if (trimmed.length === 0)
        continue
      const isLast = i === rawSegments.length - 1
      const hadTrailingWS = !isLast && rawSegments[i].endsWith(trimmed) === false
      segments.push(hadTrailingWS ? `${trimmed} ` : trimmed)
    }

    return segments.length > 0 ? segments : [text]
  }
  catch {
    return [text]
  }
}
