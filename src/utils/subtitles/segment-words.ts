interface WordToken {
  text: string
  isWord: boolean
}

const segmenters = new Map<string | undefined, Intl.Segmenter>()

function createSegmenter(locale: string | undefined) {
  try {
    return new Intl.Segmenter(locale, { granularity: "word" })
  } catch {
    return new Intl.Segmenter(undefined, { granularity: "word" })
  }
}

function getSegmenter(locale: string | undefined) {
  let segmenter = segmenters.get(locale)
  if (!segmenter) {
    segmenter = createSegmenter(locale)
    segmenters.set(locale, segmenter)
  }
  return segmenter
}

export function segmentWords(text: string, locale?: string): WordToken[] {
  return Array.from(getSegmenter(locale).segment(text), (segment) => ({
    text: segment.segment,
    isWord: segment.isWordLike === true,
  }))
}
