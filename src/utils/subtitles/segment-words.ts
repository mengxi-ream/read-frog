export interface WordToken {
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

/**
 * Splits a subtitle line into clickable word tokens and the punctuation and
 * whitespace between them. ICU word segmentation handles scripts without
 * spaces (Chinese, Japanese, Thai) by dictionary, so a word is a word in every
 * language the subtitles can arrive in. An unrecognised locale tag falls back
 * to the default segmenter rather than throwing in the render path.
 */
export function segmentWords(text: string, locale?: string): WordToken[] {
  if (!text) {
    return []
  }

  return Array.from(getSegmenter(locale).segment(text), (segment) => ({
    text: segment.segment,
    isWord: segment.isWordLike === true,
  }))
}
