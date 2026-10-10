interface WordToken {
  text: string
  isWord: boolean
}

const segmenters = new Map<string, Intl.Segmenter>()

function createSegmenter(locale: string | undefined) {
  try {
    return new Intl.Segmenter(locale, { granularity: "word" })
  } catch {
    return new Intl.Segmenter(undefined, { granularity: "word" })
  }
}

function getSegmenter(locale: string | undefined) {
  const key = locale ?? ""
  let segmenter = segmenters.get(key)
  if (!segmenter) {
    segmenter = createSegmenter(locale)
    segmenters.set(key, segmenter)
  }
  return segmenter
}

export function segmentWords(text: string, locale?: string): WordToken[] {
  if (!text) {
    return []
  }

  return Array.from(getSegmenter(locale).segment(text), (segment) => ({
    text: segment.segment,
    isWord: segment.isWordLike === true,
  }))
}
